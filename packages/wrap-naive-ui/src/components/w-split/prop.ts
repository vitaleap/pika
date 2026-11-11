import type { SplitProps } from 'naive-ui'

export interface WSplitProps {
  /** 分割方向 */
  direction?: SplitProps['direction']
  /** 初始面板尺寸；`number` 时为 `0-1` 比例，`string` 时为 `${number}px` */
  defaultSize?: string | number
  /** 面板最小尺寸 */
  minSize?: string | number
  /** 面板最大尺寸 */
  maxSize?: string | number
  /** 分隔条大小（px） */
  resizeTriggerSize?: SplitProps['resizeTriggerSize']
  /** 禁用拖拽 */
  disabled?: boolean
  /** 折叠面板标识，配合 `collapsed` 使用 */
  collapsePane?: '1' | '2'
  /** 透传给触发器容器的类名 */
  resizeTriggerClass?: string
  /** 透传给触发器块的类名 */
  resizeTriggerBlockClass?: string
}

export const WSplitDefaults = {
  direction: 'horizontal',
  resizeTriggerSize: 8,
  collapsePane: '1',
} as const satisfies Partial<WSplitProps>
