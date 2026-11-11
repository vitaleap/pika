<!-- 仅渲染一个图标按钮（quaternary 样式），封装自 n-button -->
<template>
  <n-button
    class="w-icon-button"
    :size="typeof merged.size === 'number' ? undefined : merged.size"
    :type="merged.type"
    :disabled="merged.disabled"
    quaternary
    style="--n-padding: 0 0px; width: var(--n-height)"
    :style="compStyle"
    @click="handleClick"
  >
    <template #icon>
      <slot></slot>
    </template>
  </n-button>
</template>

<script setup lang="ts">
import { NButton } from 'naive-ui'
import { computed, inject } from 'vue'
import { wConfigProviderInjectionKey } from '../../config-provider'
import { WIconButtonDefaults, type WIconButtonProps } from './prop'

// defaultProps 保留 undefined，让 w-config-provider 能在 prop 未传时介入（prop > provider > defaults）
const defaultProps = defineProps<WIconButtonProps>()

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()

const injected = inject(wConfigProviderInjectionKey, undefined)
const merged = computed<WIconButtonProps>(() => {
  const o = injected?.value?.IconButton
  const userProps = Object.fromEntries(
    Object.entries(defaultProps).filter(([_, v]) => v !== undefined),
  ) as Partial<WIconButtonProps>
  return Object.assign({}, WIconButtonDefaults, o, userProps)
})

// 按 size / iconSize 派生 CSS 变量
const compStyle = computed(() => {
  const style = { ...merged.value.style }

  const { size, borderRadius } = merged.value
  if (borderRadius) {
    Object.assign(style, { '--n-border-radius': `${borderRadius}px` })
  }
  if (typeof size === 'number') {
    Object.assign(style, { '--n-height': `${size}px` })
  }
  if (merged.value.iconSize) {
    style['--n-icon-size'] = `${merged.value.iconSize}px`
  }
  return style
})

const handleClick = (e: MouseEvent) => {
  if (merged.value.href) {
    window.open(merged.value.href, '_blank', 'noopener,noreferrer')
  }
  e.preventDefault()
  emit('click', e)
}
</script>

<style lang="scss"></style>
