<!-- 封装自 n-tabs：用作分段单选块，options 切换选中项 -->
<template>
  <div :class="['w-radio-block', { 'w-radio-block--disabled': merged.disabled }]">
    <n-tabs
      v-model:value="value"
      :size="merged.size"
      class="w-radio-block__tabs"
      type="segment"
      animated
    >
      <n-tab-pane v-for="item in merged.options" :key="item.key" :name="item.key">
        <template #tab>{{ item.name }}</template>
      </n-tab-pane>
    </n-tabs>
  </div>
</template>

<script setup lang="ts" generic="K extends string">
import { NTabs, NTabPane } from 'naive-ui'
import { computed, inject } from 'vue'
import { wConfigProviderInjectionKey } from '../../config-provider'
import { WRadioBlockDefaults, type WRadioBlockProps } from './prop'

// 保留 defaultProps 为 undefined 状态，让 w-config-provider.componentOptions.RadioBlock
// 能在 prop 未传时介入（优先级：prop > provider > defaults）
const defaultProps = defineProps<WRadioBlockProps<K>>()

const injected = inject(wConfigProviderInjectionKey, undefined)
const merged = computed<WRadioBlockProps<K>>(() => {
  const o = injected?.value?.RadioBlock
  const userProps = Object.fromEntries(
    Object.entries(defaultProps).filter(([_, v]) => v !== undefined),
  ) as Partial<WRadioBlockProps<K>>
  return Object.assign({}, WRadioBlockDefaults, o, userProps) as WRadioBlockProps<K>
})

// disabled 时屏蔽 n-tabs 的 v-model 更新，使外层无法通过点击/键盘切换
const modelValue = defineModel<K>()
const value = computed({
  get: () => modelValue.value,
  set: (v) => {
    if (!merged.value.disabled) {
      modelValue.value = v
    }
  },
})
</script>

<style lang="scss">
.w-radio-block {
  width: 100%;
  &.w-radio-block--disabled {
    pointer-events: none;
    opacity: 0.5;
  }
  .w-radio-block__tabs.n-tabs {
    .n-tabs-tab {
      padding: 4px 12px;
      font-size: var(--text-size-xs);
      cursor: default;
      color: var(--color-text-2);
      &:hover {
        color: var(--color-text-2) !important;
      }
    }
    .n-tabs-tab--active {
      color: var(--color-text-1) !important;
      &:hover {
        color: var(--color-text-1) !important;
      }
    }

    &.n-tabs--large-size {
      .n-tabs-tab {
        padding: 4px 16px;
        font-size: var(--text-size-sm);
      }
    }
  }
}
</style>
