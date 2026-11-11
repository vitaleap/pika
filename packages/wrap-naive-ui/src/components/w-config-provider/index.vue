<template>
  <slot />
</template>

<script setup lang="ts">
import { provide, toRef } from 'vue'
import { wConfigProviderInjectionKey, type WComponentOptions } from '../../config-provider'

const props = defineProps<{
  /**
   * 各组件的默认 props 覆盖，key 为组件名。
   * 与组件自身 prop 同名时，组件 prop 优先级更高。
   */
  componentOptions?: WComponentOptions
}>()

provide(
  wConfigProviderInjectionKey,
  toRef(() => props.componentOptions),
)
</script>
