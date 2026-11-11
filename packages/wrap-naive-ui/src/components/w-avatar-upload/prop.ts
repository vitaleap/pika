import type { WAvatarProps } from '../w-avatar/prop'
import type { WUploadProps } from '../w-upload/prop'

/**
 * 组合自 WAvatarProps + WUploadProps。
 * - `showFileList`：头像上传场景无意义，剔除
 * - `customRequest`：由 w-upload 通过 w-config-provider.componentOptions.Upload.customRequest
 *   全局接管，业务方不需在 w-avatar-upload 上单独传
 */
export interface WAvatarUploadProps
  extends WAvatarProps, Omit<WUploadProps, 'showFileList' | 'customRequest'> {
  /** 最大文件大小（字节），默认 `5MB`，传 `0` 表示不限制 */
  maxSize?: number
}

export const WAvatarUploadDefaults = {
  accept: 'image/*',
  maxSize: 5 * 1024 * 1024,
} as const satisfies Partial<WAvatarUploadProps>

/**
 * 默认校验（类型 / 大小）失败原因。
 *
 * 组件不内置文案，由调用方根据 `code` 自行翻译。
 */
export type WAvatarUploadError =
  { code: 'INVALID_TYPE' } | { code: 'FILE_TOO_LARGE'; maxSizeMb: number }
