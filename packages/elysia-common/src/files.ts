import { createFiles, type DownloadOptions, type StoredFile } from 'files-sdk'
import { fs, type FsAdapter } from 'files-sdk/fs'
import { s3, type S3Adapter } from 'files-sdk/s3'
import { ValidationError, validation } from 'files-sdk/validation'
import { z } from 'zod'
import { resolvePath } from './utils/path'

/**
 * 文件存储配置；由调用方从业务配置库（如 `ConfigRepository`）注入。
 * 适配 fs（本地存储）与 S3 兼容对象存储（OSS）。
 */
export interface FileConfig {
  /** 单文件最大尺寸，单位字节 */
  maxSize: number
  /** 允许的文件类型白名单（在默认列表上叠加） */
  allowedTypes: string[]
  /** 禁用的文件类型黑名单 */
  disabledTypes: string[]
  /** 是否启用对象存储；false 时使用本地 fs 适配器 */
  ossEnabled: boolean
  /** S3 兼容服务端点（ossEnabled: true 时必填） */
  ossEndpoint?: string
  /** S3 桶名 */
  ossBucket?: string
  /** S3 access key id */
  ossAccessKeyId?: string
  /** S3 secret access key */
  ossSecretAccessKey?: string
  /** S3 region */
  ossRegion?: string
  /** 是否使用 path-style 访问 */
  ossForcePathStyle?: boolean
  /** 预签名 URL 默认过期时间（秒） */
  ossDefaultUrlExpiresIn?: number
  /**
   * 是否隐藏文件的真实 URL；默认 false
   *
   * - false：下载返回预签名直链，由调用方 302 跳转，文件流量不过服务器
   * - true：下载由服务端代理读取文件流，客户端拿不到对象存储地址
   */
  ossHideFileUrl?: boolean
}

/**
 * 调用方注入的目标错误类（通常为框架提供的 HttpError）；参数 `(message, status?, detail?)`。
 */
export interface FilesErrorInstance {
  message: string
  status?: number
  detail?: string
}
export interface FilesErrorClass {
  new (message: string, status?: number, detail?: string): FilesErrorInstance
}

export interface FilesDeps {
  /**
   * 异步获取文件配置；每次上传/下载调用一次。
   * 返回值会与缓存比对，配置变化时自动重建适配器与校验插件，无需重启应用。
   */
  getFileConfig: () => Promise<FileConfig>
  /** i18n 文案翻译函数；接收 key 返回对应文案（i18n token 或直接字符串均可） */
  t: (key: string) => string
  /** 错误类构造器 */
  ErrorClass: FilesErrorClass
  /** 本地存储路径（ossEnabled: false 时生效） */
  filePath: string
}

export interface UploadResult {
  name: string
  size: number
  type: string
}

type Files = ReturnType<typeof createFiles>

/**
 * 下载结果：
 * - `file`：服务端流式返回文件内容
 * - `url`：对象存储直链，由调用方 302 跳转，文件流量不过服务器
 */
export type DownloadResult =
  | {
      type: 'file'
      file: StoredFile
    }
  | {
      type: 'url'
      /** 直链 URL，客户端可直接访问 */
      url: string
      /** 直链过期时间，单位秒 */
      expiresIn: number
    }

export interface FilesService {
  /** 上传文件并返回元信息 */
  upload: (file: File | Blob, filename: string) => Promise<UploadResult>
  /** 下载文件；OSS 未隐藏文件 URL 时返回直链 */
  download: (filename: string, opts?: DownloadOptions) => Promise<DownloadResult>
}

// https://mime.wcode.net/zh-hans/
const DEFAULT_ALLOWED_TYPES = [
  'text/plain',
  'text/markdown',
  'text/csv',
  // image
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  // video
  'video/mp4',
  'video/quicktime',
  'video/avi',
  'video/flv',
  // audio
  'audio/mp3',
  'audio/aac',
  'audio/wav',
  'audio/flac',
  // other
  'application/vnd.openxmlformats-officedocument.*', // docx, xlsx, pptx
  'application/x-ms*', // doc xls ppt
  'application/pdf',
  'application/xml',
  'application/sql',
  'application/json',
  'application/m3u',
  'application/zip',
  'application/yaml',
]

/** OSS 直链缺省过期时间（秒），与 files-sdk 默认值保持一致 */
const DEFAULT_URL_EXPIRES_IN = 3600

/**
 * 直链强制以附件下载：对象存储不会主动带 `attachment`，用户上传的 html/svg
 * 会在存储域名下按 `Content-Type` 内联执行（存储型 XSS）。
 * 文件名仅用于响应头，去掉引号与反斜杠避免头部注入。
 */
const attachmentDisposition = (filename: string) =>
  `attachment; filename="${filename.replace(/["\\]/g, '_')}"`

const s3ConfigSchema = z.object({
  ossEndpoint: z.url(),
  ossBucket: z.string().min(1),
  ossAccessKeyId: z.string().min(1),
  ossSecretAccessKey: z.string().min(1),
  ossRegion: z.string().optional(),
  ossForcePathStyle: z.boolean().optional(),
  ossDefaultUrlExpiresIn: z.number().optional(),
})

/**
 * 创建文件上传/下载服务。
 *
 * 通过依赖注入复用调用方的配置、i18n 函数与错误类，避免包内 import 具体业务模块。
 * 框架中立，可在任意 Node / Bun 服务中复用。
 *
 * @example
 * ```ts
 * const { upload, download } = createFilesService({
 *   getFileConfig: () => ConfigRepository.get().then(c => c.file),
 *   t,
 *   ErrorClass: HttpError,
 *   // 必填：本地存储根目录
 *   filePath: config.filePath,
 * })
 * ```
 */
export const createFilesService = ({
  getFileConfig,
  t,
  ErrorClass,
  filePath,
}: FilesDeps): FilesService => {
  /** 已构建实例 + 构建时的配置指纹；配置变化后自动重建 */
  let cached: { signature: string; files: Files; config: FileConfig } | undefined

  const buildAdapter = (file: FileConfig): FsAdapter | S3Adapter => {
    if (!file.ossEnabled) {
      return fs({ root: resolvePath(filePath) })
    }
    const result = s3ConfigSchema.safeParse(file)
    if (!result.success) {
      // 复用 OSS_REGION_REQUIRED 作为 S3 配置不合法的兜底文案，detail 透传 zod 错误详情
      throw new ErrorClass(t('OSS_REGION_REQUIRED'), 400, result.error.message)
    }
    const s3Config = result.data
    if (!s3Config.ossRegion) {
      throw new ErrorClass(t('OSS_REGION_REQUIRED'), 400)
    }
    return s3({
      endpoint: s3Config.ossEndpoint,
      bucket: s3Config.ossBucket,
      region: s3Config.ossRegion,
      credentials: {
        accessKeyId: s3Config.ossAccessKeyId,
        secretAccessKey: s3Config.ossSecretAccessKey,
      },
      forcePathStyle: s3Config.ossForcePathStyle,
      defaultUrlExpiresIn: s3Config.ossDefaultUrlExpiresIn,
    })
  }

  const buildValidation = (file: FileConfig) =>
    validation({
      maxSize: file.maxSize,
      allowedTypes: DEFAULT_ALLOWED_TYPES.concat(file.allowedTypes)
        .filter((type) => !file.disabledTypes.includes(type) && type.length > 0)
        .map((type) => type.trim()),
      key: /^[\w.-]+$/,
    })

  /**
   * 按配置指纹复用实例：配置（含 OSS 凭证、尺寸/类型限制）变更后重建，
   * 避免后台改配置必须重启应用才生效。
   */
  const ensureFiles = async (): Promise<{ files: Files; config: FileConfig }> => {
    const config = await getFileConfig()
    const signature = JSON.stringify(config)
    if (cached?.signature === signature) {
      return cached
    }
    const files = createFiles({
      adapter: buildAdapter(config),
      plugins: [buildValidation(config)],
    })
    cached = { signature, files, config }
    return cached
  }

  return {
    upload: async (file, filename) => {
      const { files } = await ensureFiles()
      try {
        const meta = await files.file(filename).upload(file)
        return { name: filename, size: meta.size, type: meta.contentType }
      } catch (error) {
        if (error instanceof ValidationError && error.reason === 'type') {
          throw new ErrorClass(t('FILE_TYPE_UNSUPPORTED'), 415)
        }
        if (error instanceof ValidationError && error.reason === 'size') {
          throw new ErrorClass(t('FILE_SIZE_INVALID'), 413)
        }
        throw new ErrorClass(
          t('FILE_UPLOAD_FAILED'),
          400,
          error instanceof Error ? error.message : String(error),
        )
      }
    },

    download: async (filename, opts) => {
      const { files, config } = await ensureFiles()
      const file = files.file(filename)
      if (!(await file.exists())) {
        throw new ErrorClass(t('FILE_NOT_FOUND'), 404)
      }
      // 未隐藏文件 URL：下发 OSS 直链，由调用方跳转，客户端直连对象存储
      if (config.ossEnabled && !config.ossHideFileUrl) {
        const expiresIn = config.ossDefaultUrlExpiresIn ?? DEFAULT_URL_EXPIRES_IN
        const url = await file.url({
          expiresIn,
          responseContentDisposition: attachmentDisposition(filename),
        })
        return { type: 'url', url, expiresIn }
      }
      return { type: 'file', file: await file.download(opts) }
    },
  }
}
