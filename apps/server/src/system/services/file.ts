import { createHash } from 'node:crypto'
import { extname } from 'node:path'
import type { DownloadResult, FileConfig } from '@pika/elysia-common'
import { cache } from '@/common/cache'
import { config } from '@/common/config'
import { t } from '@/common/plugins/i18n'
import { snowflake } from '@/common/snowflake'
import { ConfigService } from '@/system/services/config'
import { z } from 'zod'
import { download, upload } from '@/common/files'

const FILE_NAME_PATTERN = /^[0-9]+(?:\.[a-zA-Z0-9]+)?$/

/** 直链缓存前缀；同一文件在有效期内复用预签名 URL，避免重复签名 */
const URL_CACHE_KEY = 'system:file:url'

/**
 * 存储位置指纹，参与缓存键。
 *
 * endpoint / bucket / 凭证 / region / pathStyle 变更后，旧直链指向的是旧存储位置
 * 或已失效凭证，必须换键重新签名。
 *
 * 不含 `ossDefaultUrlExpiresIn`：过期时间在签发时就写进了直链，改配置不影响
 * 已颁发直链的可用性，没必要因此让缓存失效（旧直链用到自然过期即可）。
 * 用摘要而非明文，避免密钥出现在缓存键里。
 */
const storageFingerprint = (fileConfig: FileConfig) =>
  createHash('sha256')
    .update(
      JSON.stringify(
        Object.entries(fileConfig).filter(
          ([key]) => key.startsWith('oss') && key !== 'ossDefaultUrlExpiresIn',
        ),
      ),
    )
    .digest('hex')
    .slice(0, 16)

type CachedUrl = {
  url: string
  /** 直链过期时间戳（毫秒），用于命中时算出剩余有效期 */
  expiresAt: number
}

export abstract class FileService {
  static UploadBodySchema = z.object({
    file: z.file(),
  })

  static UploadRespSchema = z.object({
    name: z.string(),
    url: z.string(),
    type: z.string(),
  })

  static upload = async (
    body: z.infer<typeof FileService.UploadBodySchema>,
  ): Promise<z.infer<typeof FileService.UploadRespSchema>> => {
    const originalName = body.file.name || 'unknown'
    const fileExt = extname(originalName).toLowerCase()
    const fileName = `${snowflake.nextId()}${fileExt}`
    await upload(body.file, fileName)
    return {
      name: originalName,
      url: `${config.basePath}/system/file/${fileName}`,
      type: body.file.type || 'application/octet-stream',
    }
  }

  static GetParamsSchema = z.object({
    filename: z
      .string()
      .min(1, t('COMMON.FILENAME_REQUIRED'))
      .refine((filename) => FILE_NAME_PATTERN.test(filename), t('COMMON.FILENAME_INVALID')),
  })

  // gravatar 头像文件名为 32 位 MD5 哈希，可带扩展名
  static GetAvatarParamsSchema = z.object({
    filename: z
      .string()
      .min(1, t('COMMON.FILENAME_REQUIRED'))
      .regex(/^[a-f0-9]{32}(?:\.[a-zA-Z0-9]+)?$/i, t('COMMON.FILENAME_INVALID')),
  })
  static get = async (
    params: z.infer<typeof FileService.GetParamsSchema>,
  ): Promise<DownloadResult> => {
    const { file: fileConfig } = await ConfigService.get()
    // 只有 OSS 直链模式需要缓存；隐藏 URL 走服务端代理，配置变更需立即生效
    const cacheKey =
      fileConfig.ossEnabled && !fileConfig.ossHideFileUrl
        ? `${URL_CACHE_KEY}:${storageFingerprint(fileConfig)}:${params.filename}`
        : undefined

    if (cacheKey) {
      const cached = await cache.get<CachedUrl>(cacheKey)
      const expiresIn = cached ? Math.floor((cached.expiresAt - Date.now()) / 1000) : 0
      if (cached && expiresIn > 0) {
        return { type: 'url', url: cached.url, expiresIn }
      }
    }

    const result = await download(params.filename, { as: 'stream' })
    if (cacheKey && result.type === 'url') {
      await cache.set(
        cacheKey,
        { url: result.url, expiresAt: Date.now() + result.expiresIn * 1000 },
        result.expiresIn,
      )
    }
    return result
  }
}
