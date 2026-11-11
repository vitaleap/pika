import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import 'dayjs/locale/zh-cn'
import { useI18n } from 'vue-i18n'
import type { LocaleMessages } from '@/utils/i18n'

/** 时间入参，支持日期字符串、时间戳、Date、Dayjs */
export type DateValue = string | number | Date | Dayjs | null | undefined

const DAYJS_LOCALE: Record<string, string> = { zh: 'zh-cn', en: 'en' }

const messages: LocaleMessages = {
  zh: {
    yesterday: '昨天',
    monthDay: '{month}{day}号',
    yearMonthDay: '{year}年{month}{day}号',
  },
  en: {
    yesterday: 'Yesterday',
    monthDay: '{month} {day}',
    yearMonthDay: '{month} {day}, {year}',
  },
}

/** 空值与非法时间统一返回 null */
const toDayjs = (value: DateValue) => {
  if (value == null || value === '') {
    return null
  }
  const date = dayjs(value)
  return date.isValid() ? date : null
}

/** 格式化时间，空值或非法时间返回空字符串 */
export const formatTime = (value: DateValue, template = 'YYYY-MM-DD HH:mm:ss'): string => {
  const date = toDayjs(value)
  if (!date) {
    return ''
  }
  return date.format(template)
}

/** 时间线格式化：今天 16:09 / 昨天 16:09 / 9月6号 16:09 / 2026年9月6号 16:09 */
export const useDateFormat = () => {
  const { t, locale } = useI18n({ useScope: 'isolated', messages })

  const formatTimeline = (value: DateValue, timeFormat = 'HH:mm:ss'): string => {
    const date = toDayjs(value)
    if (!date) {
      return ''
    }
    const now = dayjs()
    const localized = date.locale(DAYJS_LOCALE[locale.value] ?? 'zh-cn')
    const time = localized.format(timeFormat)
    if (date.isSame(now, 'day')) {
      return time
    }
    if (date.isSame(now.subtract(1, 'day'), 'day')) {
      return `${t('yesterday')} ${time}`
    }
    const params = { month: localized.format('MMM'), day: date.date(), year: date.year() }
    if (date.isSame(now, 'year')) {
      return `${t('monthDay', params)} ${time}`
    }
    return `${t('yearMonthDay', params)} ${time}`
  }

  return { formatTimeline }
}
