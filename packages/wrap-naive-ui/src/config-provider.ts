import type { InjectionKey, Ref } from 'vue'
import type { WAvatarProps } from './components/w-avatar/prop'
import type { WAvatarUploadProps } from './components/w-avatar-upload/prop'
import type { WIconButtonProps } from './components/w-icon-button/prop'
import type { WPickerProps } from './components/w-picker/prop'
import type { WRadioBlockProps } from './components/w-radio-block/prop'
import type { WSplitProps } from './components/w-split/prop'
import type { WUploadProps } from './components/w-upload/prop'

/**
 * 组件全局默认配置。
 * key 为组件名（PascalCase，去掉 `W` 前缀），value 为该组件的 props 局部覆盖。
 */
export interface WComponentOptions {
  Avatar?: Partial<WAvatarProps>
  AvatarUpload?: Partial<WAvatarUploadProps>
  IconButton?: Partial<WIconButtonProps>
  Picker?: Partial<WPickerProps>
  RadioBlock?: Partial<WRadioBlockProps>
  Split?: Partial<WSplitProps>
  Upload?: Partial<WUploadProps>
}

/**
 * `w-config-provider` 向后代组件注入 `component-options` 时使用的 key。
 * 使用 `Ref` 包裹，以便父级配置变化时子组件能响应式更新。
 */
export const wConfigProviderInjectionKey: InjectionKey<Ref<WComponentOptions | undefined>> =
  Symbol('w-config-provider')
