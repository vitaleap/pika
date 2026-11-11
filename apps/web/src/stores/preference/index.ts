import { defineStore } from 'pinia'
import { debounce } from 'es-toolkit'
import type { BackgroundType } from '@pika/shared'
import { getBrowserLocale, isAppLocale, type AppLocale } from '@/utils/i18n'
import { getStore, removeStore, useStorage } from '@/utils/storage'

/** 语言偏好，`system` 表示跟随浏览器语言 */
export type LanguageMode = 'system' | AppLocale

/** 时区偏好，`system` 表示跟随浏览器时区，否则为 IANA 时区（如 `Asia/Shanghai`） */
export type TimeZoneMode = string

export type { BackgroundType }

/** 单套（明亮/暗黑）外观风格 */
export type ThemeStyle = {
  /** 侧边栏背景色，空格分隔的 RGB，如 `21 21 25` */
  sidebarBgColor: string
  /** 侧边栏透明度，0-1 的字符串 */
  sidebarBgTransparency: string
  /** 背景来源 */
  mainBgType: BackgroundType
  /** 自定义上传的图片地址，切换背景类型时保留，方便用户随时切回 */
  mainBgImageUrl: string
  /** 背景模糊半径，单位 px */
  mainBgBlur: number
}

/** 账号级外观风格：明亮与暗黑两套侧边栏 / 背景设置 */
export type ThemeStyleConfig = {
  light: ThemeStyle
  dark: ThemeStyle
}

/** 内置 macOS 墙纸，按主题取用 */
export const wallpaperImages: Record<'light' | 'dark', string> = {
  light: '/images/bg/macos_pic_1_light.jpeg',
  dark: '/images/bg/macos_pic_1_dark.jpeg',
}

/** 纯色背景（无壁纸时使用） */
export const solidBackgrounds: Record<'light' | 'dark', string> = {
  light: 'rgb(248, 248, 250)',
  dark: 'rgb(14, 14, 20)',
}

/** 账号级风格的默认值，服务端不保存默认值，未保存过时由这里补齐 */
export const defaultThemeStyle: ThemeStyleConfig = {
  light: {
    sidebarBgColor: '255 255 255',
    sidebarBgTransparency: '0.95',
    mainBgType: 'color',
    mainBgImageUrl: '',
    mainBgBlur: 4,
  },
  dark: {
    sidebarBgColor: '21 21 25',
    sidebarBgTransparency: '0.95',
    mainBgType: 'color',
    mainBgImageUrl: '',
    mainBgBlur: 4,
  },
}

/** 解析当前生效的背景图地址，返回空字符串表示使用纯色背景 */
export const resolveBackgroundUrl = (style: ThemeStyle, mode: 'light' | 'dark'): string => {
  if (style.mainBgType === 'wallpaper') {
    return wallpaperImages[mode]
  }
  if (style.mainBgType === 'image') {
    return style.mainBgImageUrl
  }
  return ''
}

/** 本地缓存可能来自旧版本，按默认值补齐缺失字段；服务端未保存过时返回 `null` */
const withThemeStyleDefaults = (
  cached?: { light?: Partial<ThemeStyle>; dark?: Partial<ThemeStyle> } | null,
): ThemeStyleConfig => ({
  light: { ...defaultThemeStyle.light, ...cached?.light },
  dark: { ...defaultThemeStyle.dark, ...cached?.dark },
})

/** 旧版本把语言偏好直接存在 `locale` 键下，这里迁移到 `language` 并清理旧键 */
const readLegacyLanguage = (): LanguageMode => {
  const legacy = getStore<unknown>('locale')
  if (!isAppLocale(legacy)) {
    return 'system'
  }
  removeStore('locale')
  return legacy
}

const resolveLanguage = (language: LanguageMode): AppLocale =>
  language === 'system' ? getBrowserLocale() : language

/**
 * 用户偏好设定。
 *
 * - 语言、时区属于设备偏好，只保存在浏览器本地
 * - 明亮/暗黑风格属于账号数据，本地缓存用于首屏无闪烁，登录后以服务端为准
 */
export const usePreferenceStore = defineStore('preference', () => {
  const language = useStorage<LanguageMode>('language', readLegacyLanguage())
  const timezone = useStorage<TimeZoneMode>('timezone', 'system')
  const themeStyle = useStorage<ThemeStyleConfig>('themeStyle', defaultThemeStyle)
  themeStyle.value = withThemeStyleDefaults(themeStyle.value)

  const localeStore = useLocaleStore()
  const userStore = useUserStore()

  /** 当前生效的时区，跟随系统时为浏览器时区 */
  const resolvedTimeZone = computed(() =>
    timezone.value === 'system' ? Intl.DateTimeFormat().resolvedOptions().timeZone : timezone.value,
  )

  // 只有风格需要同步服务端，合并短时间内的连续改动（如拖动滑块）
  const flush = debounce(async () => {
    if (!userStore.isLogin) {
      return
    }
    // 失败时由请求层统一提示，此处仅避免未捕获的 Promise 异常
    await Apis.user.savePreference({ data: { appearance: themeStyle.value } }).catch(() => {})
  }, 400)

  /** 更新明亮或暗黑风格的部分字段 */
  const setStyle = (mode: 'light' | 'dark', patch: Partial<ThemeStyle>) => {
    themeStyle.value = {
      ...themeStyle.value,
      [mode]: { ...themeStyle.value[mode], ...patch },
    }
    flush()
  }

  const setLanguage = (value: LanguageMode) => {
    language.value = value
    localeStore.setLocale(resolveLanguage(value))
  }

  const setTimezone = (value: TimeZoneMode) => {
    timezone.value = value
  }

  /** 登录后拉取服务端风格；未保存过（`null`）时回落到默认值 */
  const load = async () => {
    const res = await Apis.user.getPreference({ meta: { toast: false } }).catch(() => undefined)
    if (!res) {
      return
    }
    themeStyle.value = withThemeStyleDefaults(res.appearance)
  }

  /** 退出登录时清空账号级风格，避免下一个账号复用上一个账号的本地缓存 */
  const reset = () => {
    themeStyle.value = withThemeStyleDefaults()
  }

  // 启动时先应用本地缓存，避免刷新时闪烁
  localeStore.setLocale(resolveLanguage(language.value))

  return {
    themeStyle,
    language,
    timezone,
    resolvedTimeZone,
    load,
    reset,
    setStyle,
    setLanguage,
    setTimezone,
  }
})
