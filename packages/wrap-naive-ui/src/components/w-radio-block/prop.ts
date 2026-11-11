import type { TabsProps } from 'naive-ui'

export interface WRadioBlockProps<K extends string = string> {
  size?: TabsProps['size']
  options: { name: string; key: K }[]
  disabled?: boolean
}

export const WRadioBlockDefaults = {} as const satisfies Partial<WRadioBlockProps>
