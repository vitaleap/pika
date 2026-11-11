<!-- 通用 chip 下拉选择器，封装自 n-dropdown -->
<template>
  <n-dropdown
    class="w-picker"
    trigger="click"
    size="small"
    :scrollable="true"
    :options="merged.options"
    :value="modelValue"
    :disabled="merged.disabled"
    :placement="merged.placement"
    @select="handleSelect"
  >
    <div
      class="chip-box"
      :class="{
        'chip-box--disabled': merged.disabled,
        'text-size-sm': merged.size === 'medium',
        'text-size-xs': merged.size === 'small',
        'pr-1!': merged.showArrow,
      }"
    >
      <slot name="icon"></slot>
      <span v-if="labelOf === undefined" class="color-text-4">
        {{ merged.placeholder }}
      </span>
      <slot name="default" v-else>
        <component v-if="typeof labelOf === 'function'" :is="labelOf()"></component>
        <span v-else>
          {{ labelOf }}
        </span>
      </slot>
      <span
        v-if="merged.showArrow"
        class="i-mdi-chevron-down"
        :class="{
          'text-size-base': merged.size === 'medium',
          'text-size-sm': merged.size === 'small',
        }"
      ></span>
    </div>
  </n-dropdown>
</template>

<script setup lang="ts" generic="K extends string">
import { NDropdown, type DropdownOption } from 'naive-ui'
import { computed, inject, isVNode, type VNode } from 'vue'
import { wConfigProviderInjectionKey } from '../../config-provider'
import { WPickerDefaults, type WPickerProps } from './prop'

// 保留 defaultProps 为 undefined 状态，让 w-config-provider.componentOptions.Picker
// 能在 prop 未传时介入（优先级：prop > provider > defaults）
const defaultProps = defineProps<WPickerProps<K>>()

const emit = defineEmits<{
  change: [value: K, option: DropdownOption]
}>()

const modelValue = defineModel<K>('value')

const injected = inject(wConfigProviderInjectionKey, undefined)
const merged = computed<WPickerProps<K>>(() => {
  const o = injected?.value?.Picker
  const userProps = Object.fromEntries(
    Object.entries(defaultProps).filter(([_, v]) => v !== undefined),
  ) as Partial<WPickerProps<K>>
  return Object.assign({}, WPickerDefaults, o, userProps) as WPickerProps<K>
})

/** 递归查找选项：支持分组（type: 'group' 的 children）内的子项 */
const findOption = (
  key: K,
  items: DropdownOption[] = merged.value.options,
): DropdownOption | undefined => {
  for (const item of items) {
    if (item.key === key) {
      return item
    }
    if (item.type === 'group' && item.children) {
      const found = findOption(key, item.children)
      if (found) {
        return found
      }
    }
  }
  return undefined
}

/** 当前值对应的 label，无匹配时回退显示 key */
const labelOf = computed<string | (() => VNode) | undefined>(() => {
  const key = modelValue.value
  if (!key) {
    return undefined
  }
  const option = findOption(key)
  if (!option) {
    return undefined
  }
  const fmt = merged.value.format
  if (fmt !== undefined) {
    const res = fmt(key, option)
    if (isVNode(res)) {
      return () => {
        return res
      }
    }
    return res
  }
  return typeof option.label === 'string' ? option.label : (option.label as string)
})

/** 选中选项：值变化时回写 v-model 并触发 change */
const handleSelect = (key: string) => {
  if (merged.value.disabled || key === modelValue.value) {
    return
  }
  const option = findOption(key as K)
  if (!option) {
    return
  }
  modelValue.value = key as K
  emit('change', key as K, option)
}
</script>

<style lang="scss" scoped>
.chip-box {
  display: flex;
  flex-direction: row;
  align-items: center;
  color: var(--color-text-2);
  gap: 4px;
  padding: 4px 8px;
  border-radius: 4px;
  &:hover {
    background-color: var(--color-hover);
  }
  &:active {
    background-color: var(--color-active);
  }
  &.chip-box--disabled {
    opacity: 0.5;
    pointer-events: none;
  }
}
</style>

<style lang="scss">
.w-picker {
  --w-picker-dropdown-height: 400px;
  > .n-scrollbar {
    max-height: min(var(--w-picker-dropdown-height), 90vh);
  }
}
</style>
