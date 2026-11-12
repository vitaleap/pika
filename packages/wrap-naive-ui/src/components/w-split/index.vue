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
      <slot name="resize-trigger" :on-pointer-down="handlePointerDown">
        <div
          ref="resizeTriggerRef"
          class="resize-trigger"
          :class="merged.resizeTriggerClass"
          @pointerdown="handlePointerDown"
        >
          <div class="resize-trigger-block" :class="merged.resizeTriggerBlockClass"></div>
        </div>
      </slot>
    </template>
  </n-split>
</template>

<script setup lang="ts">
import { NSplit } from 'naive-ui'
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue'
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
const resizeTriggerRef = ref<HTMLElement | null>(null)

/** 转发为等效鼠标事件，让 naive-ui 的 Split 能响应触摸拖拽 */
const forwardMouse = (target: EventTarget, type: string, e?: PointerEvent) => {
  target.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: e?.clientX ?? 0,
      clientY: e?.clientY ?? 0,
    }),
  )
}

// naive-ui 的 Split 只监听鼠标事件，触摸屏（iPad 等）无法拖拽，
// 这里把 pointer 事件转发成鼠标事件，复用其内部的尺寸计算与边界约束
let stopPointerDrag: (() => void) | null = null

function handlePointerDown(e: PointerEvent) {
  // 鼠标交给 naive-ui 自身处理，避免重复响应
  if (e.pointerType === 'mouse') return
  const triggerEl = resizeTriggerRef.value
  if (!triggerEl) return

  // 多指同时触摸时，先结束上一次拖拽
  stopPointerDrag?.()

  const { pointerId } = e
  forwardMouse(triggerEl, 'mousedown', e)

  const handlePointerMove = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return
    forwardMouse(document, 'mousemove', ev)
  }
  const handlePointerEnd = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return
    stopPointerDrag?.()
  }

  stopPointerDrag = () => {
    stopPointerDrag = null
    document.removeEventListener('pointermove', handlePointerMove)
    document.removeEventListener('pointerup', handlePointerEnd)
    document.removeEventListener('pointercancel', handlePointerEnd)
    // 通知 naive-ui 结束拖拽（清理其全局鼠标监听与 cursor）
    forwardMouse(document, 'mouseup')
  }
  document.addEventListener('pointermove', handlePointerMove)
  document.addEventListener('pointerup', handlePointerEnd)
  document.addEventListener('pointercancel', handlePointerEnd)
}

onBeforeUnmount(() => stopPointerDrag?.())

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
  // 拖拽中：禁用过渡与文本选中，并保持高亮（鼠标与触屏一致）
  &.is-dragging {
    user-select: none;
    // 仅作用于当前 w-split 自身的 pane，避免影响嵌套 w-split
    > .n-split-pane-1,
    > .n-split-pane-2 {
      transition: none;
    }
    > .n-split__resize-trigger-wrapper .resize-trigger-block {
      background-color: var(--n-resize-trigger-color-hover);
    }
  }

  .resize-trigger {
    position: relative;
    width: 100%;
    height: 100%;
    // 触屏拖拽时阻止页面滚动/缩放，保证 pointermove 持续触发
    touch-action: none;
  }

  // 手指精度低，扩大拖拽热区；伪元素上的事件仍归属 .resize-trigger
  @media (pointer: coarse) {
    > .n-split__resize-trigger-wrapper > .resize-trigger::before {
      content: '';
      position: absolute;
    }
    &.n-split--horizontal > .n-split__resize-trigger-wrapper > .resize-trigger::before {
      inset: 0 -8px;
    }
    &.n-split--vertical > .n-split__resize-trigger-wrapper > .resize-trigger::before {
      inset: -8px 0;
    }
  }

  // 用子选择器限定自身，避免嵌套 w-split 且方向不同时互相污染
  &.n-split--horizontal {
    > .n-split__resize-trigger-wrapper > .resize-trigger {
      display: flex;
      justify-content: center;
      .resize-trigger-block {
        width: 50%;
        height: 100%;
      }
    }
  }
  &.n-split--vertical {
    > .n-split__resize-trigger-wrapper > .resize-trigger {
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
    .resize-trigger-block {
      border-radius: 8px;
    }
  }

  // 触屏的 :hover/:active 抬起后不会失效，因此悬停高亮只在支持 hover 的设备生效
  @media (hover: hover) {
    .n-split__resize-trigger-wrapper:hover,
    .resize-trigger:hover {
      .resize-trigger-block {
        background-color: var(--n-resize-trigger-color-hover);
      }
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
      // 收起时不要残留扩大的拖拽热区
      .resize-trigger::before {
        display: none;
      }
    }
  }
}
</style>
