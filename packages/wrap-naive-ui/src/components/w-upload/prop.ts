import type { UploadFileInfo } from 'naive-ui'
import type { CustomRequest } from 'naive-ui/es/upload/src/interface'

export interface WUploadProps {
  /** 接受的文件 MIME 类型，如 'image/*' */
  accept?: string
  /** 是否显示默认文件列表，默认 false */
  showFileList?: boolean
  /**
   * 自定义上传请求。可通过 `w-config-provider.componentOptions.Upload.customRequest` 全局设置。
   */
  customRequest?: CustomRequest
  /** 上传前校验，返回 `false` 阻止上传 */
  beforeUpload?: (data: { file: UploadFileInfo }) => boolean | void
}

export const WUploadDefaults = {
  showFileList: false,
} as const satisfies Partial<WUploadProps>
