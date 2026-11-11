import { i18n } from './i18n'

const I18N_PREFIX = '$i18n.'

export const resolveTitle = (titleKey?: string): string => {
  if (!titleKey) {
    return ''
  }
  if (!titleKey.startsWith(I18N_PREFIX)) {
    return titleKey
  }
  return i18n.global.t(titleKey.slice(I18N_PREFIX.length))
}

export const i18nTitle = (titleKey: string): string => `${I18N_PREFIX}${titleKey}`
