<template>
  <div class="h-[54px] shrink-0 px-4 flex flex-row justify-between items-center">
    <!-- 左侧 min-w-0 让 flex item 能收缩到比内容小，title wrapper 加 flex-1+min-w-0 占满 left 剩余空间 -->
    <div class="flex flex-row gap-2 items-center min-w-0">
      <!-- shrink-0 避免被 left 挤压出可视区 -->
      <div class="shrink-0">
        <slot name="left">
          <w-icon-button @click="handleCollapsed">
            <n-icon
              v-if="collapsed"
              class="i-fluent-panel-left-32-regular"
              role="img"
              aria-hidden="true"
            ></n-icon>
            <n-icon
              v-else
              class="i-fluent-panel-left-32-filled"
              role="img"
              aria-hidden="true"
            ></n-icon>
          </w-icon-button>
        </slot>
      </div>

      <div
        class="min-w-0 flex-1 text-center"
        :class="{
          'h-[54px]': titleHeightFull,
        }"
      >
        <slot name="title">
          <span class="line-clamp-1">{{ compTitle }}</span>
        </slot>
      </div>
    </div>
    <!-- shrink-0 避免被 left 挤压出可视区 -->
    <div class="shrink-0">
      <slot name="right"></slot>
    </div>
  </div>
  <n-divider class="my-0! shrink-0"></n-divider>
</template>
<script setup lang="tsx">
import { throttle } from 'es-toolkit'
import { resolveTitle } from '@/utils/i18n-title'

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
const handleCollapsed = throttle(
  () => {
    collapsed.value = !collapsed.value
  },
  250,
  { edges: ['leading'] },
)

const route = useRoute()
const compTitle = computed(() => {
  const metaTitle = typeof route.meta.title === 'string' ? route.meta.title : ''
  return resolveTitle(props.title ?? metaTitle)
})
</script>
