import type { AvatarProps } from 'naive-ui'

export interface WAvatarProps {
  /** 图片地址。绝对 URL 走 `/api/file/avatar` 代理，相对路径直接拼接 baseUrl */
  src?: string
  size?: AvatarProps['size']
  fontSize?: number
  round?: boolean
  /** 未传时根据 text/url 哈希派生稳定颜色 */
  color?: string
  lazy?: boolean
  text?: string
  textMaxChars?: number
  textCase?: 'upper' | 'lower' | 'default'
  /** 前缀地址。绝对 URL 时拼接为 `/api/file/avatar?url=...`，相对路径时直接拼接 */
  baseUrl?: string
}

/**
 * 组件本地默认值（最低优先级）。新增带默认值的 prop 时，
 * 同步在此声明，组件内部按 `prop > provider > defaults` 合并。
 */
export const WAvatarDefaults = {
  round: false,
  lazy: false,
  textMaxChars: 1,
  textCase: 'upper',
} as const satisfies Partial<WAvatarProps>
