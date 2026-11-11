<template>
  <n-split
    class="w-split h-full min-h-0"
    v-model:size="splitSize"
    :direction="merged.direction"
    :resize-trigger-size="merged.resizeTriggerSize"
    :default-size="merged.defaultSize"
    :min="merged.minSize"
    :max="merged.maxSize"
    :disabled="merged.disabled"
    :class="{
      'is-dragging': isDragging,
      'is-collapsed': collapsed,
      [`collapse-pane-${merged.collapsePane}`]: true,
    }"
    :theme-overrides="{
      resizableTriggerColor: 'var(--color-bg-2)',
      resizableTriggerColorHover: 'var(--color-hover)',
    }"
    @drag-start="isDragging = true"
    @drag-end="isDragging = false"
  >
    <template #1 v-if="$slots['1']">
      <slot name="1"></slot>
    </template>
    <template #2 v-if="$slots['2']">
      <slot name="2"></slot>
    </template>
    <template #resize-trigger>
      <slot name="resize-trigger">
        <div class="resize-trigger" :class="merged.resizeTriggerClass">
          <div class="resize-trigger-block" :class="merged.resizeTriggerBlockClass"></div>
        </div>
      </slot>
    </template>
  </n-split>
</template>

<script setup lang="ts">
import { NSplit } from 'naive-ui'
import { computed, inject, ref, watch } from 'vue'
import { wConfigProviderInjectionKey } from '../../config-provider'
import { WSplitDefaults, type WSplitProps } from './prop'

// 保留 defaultProps 为 undefined 状态，让 w-config-provider.componentOptions.Split
// 能在 prop 未传时介入（优先级：prop > provider > defaults）
const defaultProps = defineProps<WSplitProps>()

const injected = inject(wConfigProviderInjectionKey, undefined)
const merged = computed<WSplitProps>(() => {
  const o = injected?.value?.Split
  const userProps = Object.fromEntries(
    Object.entries(defaultProps).filter(([_, v]) => v !== undefined),
  ) as Partial<WSplitProps>
  return Object.assign({}, WSplitDefaults, o, userProps)
})

const isDragging = ref(false)
const collapsed = defineModel('collapsed', { default: false })

// 折叠前最近一次拖动后的面板尺寸，展开时恢复，避免丢失用户偏好。
const lastSplitSize = ref(merged.value.defaultSize)
const splitSize = ref(merged.value.defaultSize)

// immediate：父级初始就传入 collapsed 时同步收起面板尺寸
watch(
  collapsed,
  (val) => {
    if (val) {
      lastSplitSize.value = splitSize.value
      splitSize.value = merged.value.collapsePane === '1' ? 0 : 1
    } else {
      splitSize.value = lastSplitSize.value
    }
  },
  { immediate: true },
)
</script>

<style lang="scss">
.w-split {
  --transition-duration: 0.3s;
  --transition-type: cubic-bezier(0.4, 0, 0.2, 1);

  // 伸缩动画
  .n-split-pane-1,
  .n-split-pane-2 {
    min-width: 0;
    transition: flex-basis var(--transition-duration) var(--transition-type);
  }
  .n-split__resize-trigger-wrapper {
    transition: width var(--transition-duration) var(--transition-type);
  }
  &.is-dragging {
    // 仅作用于当前 w-split 自身的 pane，避免影响嵌套 w-split
    > .n-split-pane-1,
    > .n-split-pane-2 {
      transition: none;
    }
  }

  .resize-trigger {
    width: 100%;
    height: 100%;
  }

  &.n-split--horizontal {
    .resize-trigger {
      display: flex;
      justify-content: center;
      .resize-trigger-block {
        width: 50%;
        height: 100%;
      }
    }
  }
  &.n-split--vertical {
    .resize-trigger {
      display: flex;
      align-items: center;
      .resize-trigger-block {
        width: 100%;
        height: 50%;
      }
    }
  }

  .n-split__resize-trigger-wrapper,
  .resize-trigger {
    background-color: var(--n-resize-trigger-color);
    &:hover,
    &:active {
      .resize-trigger-block {
        background-color: var(--n-resize-trigger-color-hover);
      }
    }
    .resize-trigger-block {
      border-radius: 8px;
    }
  }

  &.is-collapsed {
    &.collapse-pane-2 {
      > .n-split-pane-1 {
        flex: 0 0 100% !important;
      }
    }
    > .n-split__resize-trigger-wrapper {
      cursor: unset !important;
      width: 0 !important;
      .resize-trigger-block {
        display: none;
      }
    }
  }
}
</style>
