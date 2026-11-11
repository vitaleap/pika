<template>
  <div class="appearance-preview">
    <div class="appearance-preview__grid">
      <div v-for="mode in modes" :key="mode" class="appearance-preview__item">
        <div class="appearance-preview__screen">
          <div class="appearance-preview__wallpaper" :style="wallpaperStyle(mode)"></div>
          <div class="appearance-preview__sidebar" :style="sidebarStyle(mode)">
            <span class="appearance-preview__nav"></span>
            <span class="appearance-preview__nav"></span>
            <span class="appearance-preview__nav"></span>
          </div>
        </div>
        <span class="appearance-preview__label">{{ t(mode) }}</span>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const props = defineProps<{ themeStyle: ThemeStyleConfig }>()

const { t } = useI18n()

const modes: ('light' | 'dark')[] = ['light', 'dark']

/** 背景层：有图时应用模糊，无图时使用纯色 */
const wallpaperStyle = (mode: 'light' | 'dark') => {
  const style = props.themeStyle[mode]
  const url = resolveBackgroundUrl(style, mode)
  if (!url) {
    return { backgroundColor: solidBackgrounds[mode] }
  }
  return {
    backgroundImage: `url(${url})`,
    filter: `blur(${style.mainBgBlur}px) saturate(1.15)`,
  }
}

const sidebarStyle = (mode: 'light' | 'dark') => {
  const style = props.themeStyle[mode]
  return {
    backgroundColor: `rgba(${style.sidebarBgColor} / ${style.sidebarBgTransparency})`,
  }
}
</script>
<style lang="scss" scoped>
.appearance-preview {
  &__grid {
    @apply grid grid-cols-1 gap-4 md:grid-cols-2;
  }

  &__item {
    @apply flex flex-col items-center gap-2;
  }

  &__screen {
    @apply relative w-full overflow-hidden rounded-lg;
    aspect-ratio: 16 / 10;
    box-shadow: 0 0 0 1px var(--color-border);
  }

  // 向外扩一圈，避免模糊后边缘露出底色
  &__wallpaper {
    @apply absolute;
    inset: -8px;
    background-position: center;
    background-size: cover;
  }

  &__sidebar {
    @apply absolute bottom-0 left-0 top-0 flex flex-col gap-1.5 m-1 p-2 rounded;
    width: 24%;
    backdrop-filter: blur(6px);
  }

  &__nav {
    @apply block rounded-full;
    height: 5px;
    background: rgb(127 127 127 / 30%);
  }

  &__label {
    @apply text-xs color-text-2;
  }
}
</style>

<i18n lang="yaml">
zh:
  light: 明亮
  dark: 暗黑
en:
  light: Light
  dark: Dark
</i18n>
