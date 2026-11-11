<template>
  <div class="layout-liquid-glass h-full w-full" :style="wallpaperStyle">
    <!-- 宽屏：左右分栏（菜单 + 内容） -->
    <w-split
      v-if="isWide"
      :default-size="`${systemInfo.xxl ? 300 : systemInfo.xl ? 280 : 260}px`"
      min-size="180px"
      max-size="460px"
      :resize-trigger-size="4"
      style="--n-resize-trigger-color: transparent; --n-resize-trigger-color-hover: transparent"
      resize-trigger-class="py-6"
      :collapsed="collapsed"
      collapse-pane="1"
    >
      <template #1>
        <div class="py-2 pl-2 w-full h-full">
          <div class="glass-card w-full h-full flex flex-col">
            <left-area></left-area>
          </div>
        </div>
      </template>

      <template #2>
        <div class="h-full flex flex-col pl-2 py-2">
          <g-layout-header></g-layout-header>
          <div class="flex-1 min-h-0 overflow-y-auto py-2 pr-2">
            <div class="mx-auto max-w-3xl">
              <router-view v-slot="{ Component, route: viewRoute }">
                <keep-alive :max="5">
                  <component :is="Component" v-if="viewRoute.meta.keepAlive" />
                </keep-alive>
                <component :is="Component" v-if="!viewRoute.meta.keepAlive" />
              </router-view>
            </div>
          </div>
        </div>
      </template>
    </w-split>

    <!-- 窄屏：菜单页与内容页互斥，点击菜单项后直接进入对应页面 -->
    <template v-else>
      <div
        v-if="menuVisible"
        class="glass-card rounded-none! border-0! w-full h-full flex flex-col"
      >
        <div class="w-full flex-1 min-h-0 overflow-y-auto">
          <left-area></left-area>
        </div>
      </div>
      <template v-else>
        <div class="h-full flex flex-col p-2">
          <g-layout-header></g-layout-header>
          <div class="flex-1 min-h-0 overflow-y-auto pt-2">
            <div>
              <router-view v-slot="{ Component, route: viewRoute }">
                <keep-alive :max="5">
                  <component :is="Component" v-if="viewRoute.meta.keepAlive" />
                </keep-alive>
                <component :is="Component" v-if="!viewRoute.meta.keepAlive" />
              </router-view>
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>
<script setup lang="ts">
import LeftArea from './components/liquid-glass/left/index.vue'
import { systemInfo } from '@/composables/system.ts'

const themeStore = useThemeStore()
const preferenceStore = usePreferenceStore()
const route = useRoute()
// 玻璃层配色在整个 dashboard 布局内均生效；壁纸只在首页渲染，避免内容页被背景干扰
const wallpaperStyle = computed(() => {
  const mode = themeStore.isDark ? 'dark' : 'light'
  const style = preferenceStore.themeStyle[mode]
  let backgroundUrl = resolveBackgroundUrl(style, mode)
  if (route.path !== '/dashboard') {
    backgroundUrl = ''
  }
  return {
    backgroundColor: backgroundUrl ? undefined : solidBackgrounds[mode],
    '--glass-surface': `rgba(${style.sidebarBgColor} / ${style.sidebarBgTransparency})`,
    // 纯色背景时不渲染壁纸层
    '--wallpaper-url': backgroundUrl ? `url(${backgroundUrl})` : 'none',
    '--wallpaper-blur': `${style.mainBgBlur}px`,
  }
})

const collapsed = ref(!systemInfo.value.md)
provide('c-layout-collapsed', collapsed)

const isWide = computed(() => systemInfo.value.md)
// 窄屏下菜单页与内容页互斥：仅 /dashboard 展示菜单，其余页面直接展示目标内容
// 由当前路径直接派生，保证窗口跨过断点时也按最新路径重算，不会停在无导航入口的内容页
const menuVisible = computed(() => route.path === '/dashboard')

// 窗口跨过断点时复位，避免残留折叠态
watch(isWide, (wide) => {
  collapsed.value = !wide
})
</script>

<style lang="scss">
.layout-liquid-glass {
  // 玻璃拟态边框配色：亮/暗两套（玻璃底色与壁纸参数由 script 中的内联变量下发）
  --glass-border: rgb(255 255 255 / 90%);

  position: relative;
  isolation: isolate;
  overflow: hidden;

  // 壁纸层：向外扩一圈并轻微模糊，避免模糊后边缘露出透明
  &::before {
    position: absolute;
    z-index: -1;
    inset: -40px;
    content: '';
    background-image: var(--wallpaper-url);
    background-position: center;
    background-size: cover;
    filter: blur(var(--wallpaper-blur)) saturate(1.15);
  }

  .glass-card {
    border-radius: 16px;
    border: 1px solid var(--glass-border);
    background-color: var(--glass-surface);
    backdrop-filter: blur(12px) saturate(180%);
  }

  html[theme-mode='dark'] & {
    --glass-border: rgb(255 255 255 / 3%);

    // 暗色壁纸本身偏黑，略微提亮以保留玻璃后的层次
    &::before {
      filter: blur(var(--wallpaper-blur)) saturate(1.15) brightness(1.2);
    }
  }
}
</style>
