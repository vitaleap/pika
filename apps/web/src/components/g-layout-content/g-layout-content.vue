<template>
  <!-- 内容区：占据 header 之外的剩余高度并独立滚动 -->
  <div class="g-layout-content flex-1 min-h-0 overflow-y-auto" :class="{ 'pt-2': padded }">
    <div :class="{ 'mx-auto max-w-3xl': constrained }">
      <slot></slot>
    </div>
  </div>
</template>
<script setup lang="ts">
withDefaults(
  defineProps<{
    /** 与 header 的间距 */
    padded?: boolean
    /** 限宽居中，全屏页可关闭 */
    constrained?: boolean
  }>(),
  {
    padded: true,
    constrained: true,
  },
)
</script>
