<template>
  <div class="g-layout-header h-[50px] shrink-0 flex flex-row items-center">
    <!-- 左右两侧均为 flex-1 + basis-0 + min-w-0：basis 相同则分配到的剩余空间相同，从而永远等宽 -->
    <div class="flex-1 basis-0 min-w-0 flex flex-row gap-2 items-center">
      <!-- shrink-0 保证按钮组自身不被压缩 -->
      <div class="shrink-0 flex flex-row gap-1">
        <slot name="left">
          <div v-if="hasBack" class="glass-card icon-button" @click="handleBack">
            <n-icon class="i-fluent-chevron-left-32-regular" role="img" aria-hidden="true"></n-icon>
          </div>
          <!-- 外层容器常驻，仅过渡宽度与边距，避免按钮出现/消失时布局瞬变 -->
          <div
            class="collapse-toggle shrink-0 overflow-hidden"
            :class="showToggle ? 'w-9' : 'w-0 -ml-1'"
            :aria-hidden="!showToggle"
          >
            <div
              v-if="systemInfo.md"
              class="glass-card icon-button"
              :class="showToggle ? 'opacity-100' : 'opacity-0'"
              @click="handleCollapsed"
            >
              <n-icon class="i-fluent-panel-left-32-regular" role="img" aria-hidden="true"></n-icon>
            </div>
          </div>
        </slot>
      </div>
    </div>

    <!-- title 只占内容宽度（flex-basis:auto），保证左右两侧平分剩余空间；空间不足时自身收缩截断 -->
    <div
      class="min-w-0 text-center"
      :class="{
        'h-[50px]': titleHeightFull,
      }"
    >
      <slot name="title">
        <span class="line-clamp-1 font-bold select-none">{{ compTitle }}</span>
      </slot>
    </div>

    <!-- 与左侧保持相同的 flex 配置，justify-end 让内容始终贴右 -->
    <div class="flex-1 basis-0 min-w-0 flex flex-row justify-end items-center">
      <slot name="right"></slot>
    </div>
  </div>
</template>
<script setup lang="tsx">
import { throttle } from 'es-toolkit'
import { resolveTitle } from '@/utils/i18n-title'
import { systemInfo } from '@/composables/system'
import { hasBackRoute } from '@/router'

const props = withDefaults(
  defineProps<{
    title?: string
    titleHeightFull?: boolean
  }>(),
  {
    titleHeightFull: false,
  },
)

const collapsed = inject('c-layout-collapsed', ref(false))
// 仅桌面端（左侧栏可折叠时）展示展开/收起按钮
const showToggle = computed(() => collapsed.value && systemInfo.value.md)
const handleCollapsed = throttle(
  () => {
    collapsed.value = !collapsed.value
  },
  250,
  { edges: ['leading'] },
)

const route = useRoute()
const router = useRouter()
const compTitle = computed(() => {
  const metaTitle = typeof route.meta.title === 'string' ? route.meta.title : ''
  return resolveTitle(props.title ?? metaTitle)
})

const hasBack = computed(() => {
  return route.path.split('/').length > 2
})
const handleBack = () => {
  if (hasBackRoute()) {
    router.back()
    return
  }
  router.replace('/dashboard')
}
</script>
<style lang="scss" scoped>
.g-layout-header {
  // 与 w-split 面板收起动画保持同一时长与缓动（窄屏无 w-split 时回落到默认值）
  --toggle-duration: var(--transition-duration, 0.3s);
  --toggle-easing: var(--transition-type, cubic-bezier(0.4, 0, 0.2, 1));

  .collapse-toggle {
    transition:
      width var(--toggle-duration) var(--toggle-easing),
      margin var(--toggle-duration) var(--toggle-easing);

    .icon-button {
      transition: opacity var(--toggle-duration) var(--toggle-easing);
    }
  }

  .icon-button {
    @apply rounded-full! is-hover w-10 h-10 flex items-center justify-center;
    @apply md:w-9 md:h-9;
    .n-icon {
      @apply text-2xl;
      @apply md:text-xl;
    }
  }
}
</style>
