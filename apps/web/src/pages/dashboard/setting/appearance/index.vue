<template>
  <div class="setting-appearance h-full flex flex-col">
    <!-- hideHeader 后由页面自渲染 header 与 content -->
    <g-layout-header></g-layout-header>

    <g-layout-content>
      <div class="flex flex-col gap-2">
        <n-card content-class="py-2!">
          <np-cell-group bordered :options="themeOptions"></np-cell-group>
        </n-card>
        <div class="setting-appearance__title">{{ t('lightStyle') }}</div>
        <n-card content-class="py-2!">
          <np-cell-group bordered :options="lightOptions"></np-cell-group>
        </n-card>
        <div class="setting-appearance__title">{{ t('darkStyle') }}</div>
        <n-card content-class="py-2!">
          <np-cell-group bordered :options="darkOptions"></np-cell-group>
        </n-card>
        <div class="setting-appearance__title">{{ t('preview') }}</div>
        <n-card content-class="py-4!">
          <appearance-preview :theme-style="preferenceStore.themeStyle" />
        </n-card>
      </div>
    </g-layout-content>
  </div>
</template>
<script setup lang="tsx">
import type { NpCellGroupOption } from 'naive-plus'
import { NColorPicker, NSlider } from 'naive-ui'
import { MAIN_BG_BLUR_MAX } from '@pika/shared'
import { useI18n } from 'vue-i18n'
import { i18nTitle } from '@/utils/i18n-title'
import ThemePreview from './components/theme-preview.vue'
import PrimaryColorPicker from './components/primary-color-picker.vue'
import BackgroundPicker from './components/background-picker.vue'
import AppearancePreview from './components/appearance-preview.vue'

definePage({
  meta: {
    title: i18nTitle('pageTitle.appearance'),
    // 页面自己渲染 g-layout-header / g-layout-content
    hideHeader: true,
  },
})

const { t } = useI18n()
const themeStore = useThemeStore()
const preferenceStore = usePreferenceStore()

/** 侧边栏颜色以空格分隔的 RGB 存储，颜色选择器使用 hex */
const rgbToHex = (rgb: string): string => {
  const parts = rgb.split(' ').map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    return '#000000'
  }
  return `#${parts
    .map((value) => Math.min(255, Math.max(0, value)).toString(16).padStart(2, '0'))
    .join('')}`
}

/** 侧边栏背景色预设色板，明亮与暗黑各一套 */
const sidebarSwatches: Record<'light' | 'dark', string[]> = {
  light: ['#ffffff', '#f7f7f9', '#faf8f3', '#eef4fb', '#eef7ea', '#fdf6e6', '#f2edfb'],
  dark: ['#151519', '#1c1c22', '#24242c', '#141a26', '#16221a', '#241a12', '#1d1726'],
}

const hexToRgb = (hex: string): string => {
  const value = hex.replace('#', '')
  if (value.length !== 6) {
    return '0 0 0'
  }
  return [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16)).join(' ')
}

const renderSlider = (
  value: number,
  props: { min: number; max: number; step: number },
  format: (value: number) => string,
  onChange: (value: number) => void,
) => (
  <div class="flex flex-row items-center gap-3">
    <NSlider class="w-36" value={value} {...props} onUpdateValue={onChange} />
    <span class="w-10 text-right color-text-2 text-xs">{format(value)}</span>
  </div>
)

const themeOptions = computed<NpCellGroupOption[]>(() => [
  {
    label: t('theme'),
    value: () => (
      <ThemePreview
        modelValue={themeStore.themeMode}
        onSelect={(value: ThemeMode) => themeStore.setTheme(value)}
      />
    ),
  },
  {
    label: t('primaryColor'),
    value: () => (
      <PrimaryColorPicker
        modelValue={themeStore.primaryColor}
        onSelect={(value: PrimaryColor) => themeStore.setPrimaryColor(value)}
      />
    ),
  },
])

const styleOptions = (mode: 'light' | 'dark'): NpCellGroupOption[] => {
  const style = preferenceStore.themeStyle[mode]
  const transparency = Number(style.sidebarBgTransparency)

  return [
    {
      label: t('sidebarBgColor'),
      value: () => (
        <NColorPicker
          class="w-24"
          size="small"
          modes={['hex']}
          showAlpha={false}
          swatches={sidebarSwatches[mode]}
          value={rgbToHex(style.sidebarBgColor)}
          onUpdateValue={(value: string) =>
            preferenceStore.setStyle(mode, { sidebarBgColor: hexToRgb(value) })
          }
        />
      ),
    },
    {
      label: t('sidebarBgTransparency'),
      value: () =>
        renderSlider(
          transparency,
          { min: 0, max: 1, step: 0.01 },
          (value) => `${Math.round(value * 100)}%`,
          (value) => preferenceStore.setStyle(mode, { sidebarBgTransparency: String(value) }),
        ),
    },
    {
      label: t('background'),
      value: () => (
        <BackgroundPicker
          mode={mode}
          type={style.mainBgType}
          url={style.mainBgImageUrl}
          onChangeType={(value: BackgroundType) =>
            preferenceStore.setStyle(mode, { mainBgType: value })
          }
          onChangeUrl={(value: string) => preferenceStore.setStyle(mode, { mainBgImageUrl: value })}
          onError={(message: string) => window.$message.error(message)}
        />
      ),
    },
    {
      label: t('mainBgBlur'),
      value: () =>
        renderSlider(
          style.mainBgBlur,
          { min: 0, max: MAIN_BG_BLUR_MAX, step: 1 },
          (value) => `${value}px`,
          (value) => preferenceStore.setStyle(mode, { mainBgBlur: value }),
        ),
    },
  ]
}

const lightOptions = computed<NpCellGroupOption[]>(() => styleOptions('light'))
const darkOptions = computed<NpCellGroupOption[]>(() => styleOptions('dark'))
</script>
<style lang="scss" scoped>
.setting-appearance {
  &__title {
    @apply px-2 color-text-2 text-xs select-none pt-4;
  }

  // 右侧控件保持固定宽度，空间不足时优先压缩左侧文案
  :deep(.np-cell__left) {
    flex: 1;
    min-width: 0;
  }

  :deep(.np-cell__right) {
    flex-shrink: 0;
  }

  // 行高不一致（如主题缩略图、背景选择）时，label 与右侧内容顶部对齐
  :deep(.np-cell__wrapper) {
    align-items: flex-start;
  }
}
</style>

<i18n lang="yaml">
zh:
  theme: 主题
  primaryColor: 主题色
  lightStyle: 明亮风格
  darkStyle: 暗黑风格
  sidebarBgColor: 侧边栏背景色
  sidebarBgTransparency: 侧边栏透明度
  background: 背景
  mainBgBlur: 背景模糊
  preview: 预览
en:
  theme: Theme
  primaryColor: Theme color
  lightStyle: Light style
  darkStyle: Dark style
  sidebarBgColor: Sidebar background color
  sidebarBgTransparency: Sidebar transparency
  background: Background
  mainBgBlur: Background blur
  preview: Preview
</i18n>
