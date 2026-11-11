import type { ButtonProps } from 'naive-ui'

export interface WIconButtonProps {
  /** 尺寸：`tiny`/`medium`/`large` 透传给 n-button，`number` 仅覆盖 `--n-height`（像素），字号沿用默认尺寸 */
  size?: 'tiny' | 'medium' | 'large' | number
  /** 覆盖 `--n-icon-size` CSS 变量 */
  iconSize?: number
  /** 边框圆角 */
  borderRadius?: number
  type?: ButtonProps['type']
  disabled?: boolean
  /** 与组件内部控制变量并存的透传样式 */
  style?: import('vue').CSSProperties
  /** 设置后点击通过 `window.open` 打开新标签页 */
  href?: string
}

/** 组件本地默认值（最低优先级），合并顺序 `prop > provider > defaults` */
export const WIconButtonDefaults = {
  size: 'medium',
} as const satisfies Partial<WIconButtonProps>
