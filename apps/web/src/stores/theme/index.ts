import { defineStore } from 'pinia'
import useTheme from './use-theme'
import { useStorage } from '@/utils/storage'

type SystemTheme = 'light' | 'dark'
export type ThemeMode = SystemTheme | 'system'

/** 主题色预设标识 */
export type PrimaryColor =
  'blue' | 'purple' | 'pink' | 'red' | 'orange' | 'yellow' | 'green' | 'gray'

/** 一种主题色在单个模式下的三个色值 */
export type PrimaryColorSet = {
  /** 主色 */
  color: string
  /** 悬停色 */
  hover: string
  /** 按下色 */
  pressed: string
}

/** 主题色预设，明亮与暗黑各一套色值 */
export const primaryColorPresets: Record<
  PrimaryColor,
  Record<'light' | 'dark', PrimaryColorSet>
> = {
  blue: {
    light: { color: '#165DFF', hover: '#4080FF', pressed: '#0E42D2' },
    dark: { color: '#3C7EFF', hover: '#306FFF', pressed: '#689FFF' },
  },
  purple: {
    light: { color: '#722ED1', hover: '#9254DE', pressed: '#531DAB' },
    dark: { color: '#9254DE', hover: '#8A4AD6', pressed: '#B37FEB' },
  },
  pink: {
    light: { color: '#EB2F96', hover: '#F759AB', pressed: '#C41D7F' },
    dark: { color: '#F759AB', hover: '#EE4BA0', pressed: '#FF85C0' },
  },
  red: {
    light: { color: '#F53F3F', hover: '#F76560', pressed: '#CB2634' },
    dark: { color: '#FF5C5C', hover: '#F75050', pressed: '#FF8080' },
  },
  orange: {
    light: { color: '#FF7D00', hover: '#FF9A2E', pressed: '#D25F00' },
    dark: { color: '#FF9A2E', hover: '#FA8E1E', pressed: '#FFB65C' },
  },
  yellow: {
    light: { color: '#F7BA1E', hover: '#F9CC45', pressed: '#D29100' },
    dark: { color: '#F9CC45', hover: '#F3C133', pressed: '#FADB70' },
  },
  green: {
    light: { color: '#00B42A', hover: '#23C343', pressed: '#009A29' },
    dark: { color: '#2CC44B', hover: '#21B840', pressed: '#5AD373' },
  },
  gray: {
    light: { color: '#86909C', hover: '#A9AEB8', pressed: '#6B7785' },
    dark: { color: '#A9AEB8', hover: '#9BA1AC', pressed: '#C2C6CC' },
  },
}

/** 判断是否为合法主题色标识，用于兼容本地缓存中的非法值 */
export const isPrimaryColor = (value: unknown): value is PrimaryColor =>
  typeof value === 'string' && Object.hasOwn(primaryColorPresets, value)

export const useThemeStore = defineStore('theme', () => {
  const systemTheme = useStorage<SystemTheme>(`systemTheme`, 'light')
  const themeMode = useStorage<ThemeMode>(`themeMode`, 'system')
  const primaryColor = useStorage<PrimaryColor>('primaryColor', 'blue')
  // 本地缓存可能被手工改坏或来自预设收缩前的版本，非法值回落默认色避免渲染报错
  if (!isPrimaryColor(primaryColor.value)) {
    primaryColor.value = 'blue'
  }

  const isDark = computed(() => {
    if (themeMode.value === 'system') {
      return systemTheme.value === 'dark'
    }
    return themeMode.value === 'dark'
  })

  const setTheme = (theme: ThemeMode) => {
    themeMode.value = theme
  }

  const setPrimaryColor = (color: PrimaryColor) => {
    primaryColor.value = color
  }

  let isInit = false
  const init = () => {
    if (isInit) {
      return
    }
    isInit = true
    const updateSystemTheme = (isDark: boolean): void => {
      systemTheme.value = isDark ? 'dark' : 'light'
    }
    const { isDarkMode } = useTheme(updateSystemTheme)
    updateSystemTheme(isDarkMode())
  }

  watch(
    isDark,
    (val) => {
      nextTick(() => {
        if (val) {
          document.documentElement.setAttribute('theme-mode', 'dark')
        } else {
          document.documentElement.removeAttribute('theme-mode')
        }
      })
    },
    { immediate: true },
  )

  return { themeMode, systemTheme, primaryColor, isDark, setTheme, setPrimaryColor, init }
})
