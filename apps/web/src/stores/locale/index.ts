import { defineStore } from 'pinia'
import { i18n, getBrowserLocale, type AppLocale } from '@/utils/i18n'

export type { AppLocale as Locale } from '@/utils/i18n'

/**
 * 当前生效的界面语言（运行时状态）。
 *
 * 语言偏好统一由 `stores/preference` 的 `language` 持久化（支持「跟随系统」），
 * 这里只保存解析后的具体语言并同步给 vue-i18n，避免同一偏好存在两个存储键。
 */
export const useLocaleStore = defineStore('locale', () => {
  const locale = ref<AppLocale>(getBrowserLocale())

  const applyLocale = (value: AppLocale) => {
    i18n.global.locale.value = value
    document.documentElement.lang = value === 'zh' ? 'zh-CN' : 'en'
  }

  const setLocale = (value: AppLocale) => {
    locale.value = value
    applyLocale(value)
  }

  applyLocale(locale.value)

  return { locale, setLocale }
})
