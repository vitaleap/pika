import type { DropdownOption, DropdownProps } from 'naive-ui'
import type { VNode } from 'vue'

export interface WPickerProps<K extends string = string> {
  /** 下拉选项，key 为选项值 */
  options: DropdownOption[]
  /** 是否禁用 */
  disabled?: boolean
  /** 触发器大小 */
  size?: 'medium' | 'small'
  /** 是否显示箭头 */
  showArrow?: boolean
  /** 未选中时的占位文案 */
  placeholder: string

  placement?: DropdownProps['placement']
  /**
   * 自定义展示区
   * @returns 返回字符串或 VNode 会作为 trigger 区渲染，返回 `undefined` 表示未选中，将展示 placeholder
   */
  format?: (key: K, option: DropdownOption) => string | VNode | (() => VNode) | undefined
}

export const WPickerDefaults = {
  disabled: false,
  size: 'medium',
  showArrow: true,
} as const satisfies Partial<WPickerProps>
