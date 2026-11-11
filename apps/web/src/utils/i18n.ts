import { createI18n } from 'vue-i18n'
import messages from '@intlify/unplugin-vue-i18n/messages'

export const SUPPORTED_LOCALES = ['zh', 'en'] as const
export type AppLocale = (typeof SUPPORTED_LOCALES)[number]
export type LocaleMessages = Record<AppLocale, Record<string, string>>

export const FALLBACK_LOCALE: AppLocale = 'zh'

export const isAppLocale = (value: unknown): value is AppLocale =>
  SUPPORTED_LOCALES.some((locale) => locale === value)

/** 按浏览器语言匹配受支持的语言，未匹配到时使用兜底语言 */
export const getBrowserLocale = (): AppLocale => {
  if (typeof navigator === 'undefined') {
    return FALLBACK_LOCALE
  }
  const browserLocales = navigator.languages.length > 0 ? navigator.languages : [navigator.language]
  for (const browserLocale of browserLocales) {
    const normalizedLocale = browserLocale.toLowerCase().replaceAll('_', '-')
    const locale = SUPPORTED_LOCALES.find(
      (supportedLocale) =>
        normalizedLocale === supportedLocale || normalizedLocale.startsWith(`${supportedLocale}-`),
    )
    if (locale) {
      return locale
    }
  }
  return FALLBACK_LOCALE
}

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: FALLBACK_LOCALE,
  fallbackLocale: FALLBACK_LOCALE,
  messages,
})
