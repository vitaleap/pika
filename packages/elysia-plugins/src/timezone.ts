import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { Elysia } from 'elysia'
import { mergeVaryHeader } from './utils/vary'

dayjs.extend(utc)
dayjs.extend(timezone)

export type Dayjs = dayjs.Dayjs

/** 请求头：客户端上报的 IANA 时区，如 `Time-Zone: Asia/Shanghai` */
export const TIME_ZONE_HEADER = 'time-zone'

/** 服务器默认时区，请求未上报时区或时区非法时使用 */
export const defaultTimeZone = dayjs.tz.guess()

/** 时区合法性缓存，避免每个请求都构造一次 `Intl.DateTimeFormat` */
const timeZoneValidityCache = new Map<string, boolean>()

/** 缓存上限，key 来自客户端可控的请求头，超出后整体清空避免无限占用内存 */
const TIME_ZONE_CACHE_LIMIT = 1000

/** 时区字符串长度上限（IANA 时区名最长约 32 字符），过长直接判非法 */
const TIME_ZONE_MAX_LENGTH = 64

/** 判断是否为合法的 IANA 时区 */
export const isTimeZone = (timeZone?: string | null): boolean => {
  const value = timeZone?.trim()
  if (!value || value.length > TIME_ZONE_MAX_LENGTH) {
    return false
  }

  const cached = timeZoneValidityCache.get(value)
  if (cached !== undefined) {
    return cached
  }

  let valid = true
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value, hour12: false, timeZoneName: 'short' })
  } catch {
    valid = false
  }
  if (timeZoneValidityCache.size >= TIME_ZONE_CACHE_LIMIT) {
    timeZoneValidityCache.clear()
  }
  timeZoneValidityCache.set(value, valid)
  return valid
}

/** 解析时区：合法则返回去除空格后的值，否则回退到 `fallback`（默认服务器时区） */
export const resolveTimeZone = (
  timeZone?: string | null,
  fallback: string = defaultTimeZone,
): string => {
  const value = timeZone?.trim()
  return value && isTimeZone(value) ? value : fallback
}

/**
 * 纯数字字符串按时间戳处理，避免 dayjs 把数字串当成日期解析
 *
 * - 11 位及以上：毫秒时间戳（`Date.now()` 量级）
 * - 10 位：秒级时间戳（可覆盖到 2286 年）
 * - 更短（如 `20240101`）：交给 dayjs 按日期解析
 */
const normalizeDate = (date?: dayjs.ConfigType): dayjs.ConfigType => {
  if (typeof date !== 'string') {
    return date
  }

  const value = date.trim()
  if (!/^-?\d+$/.test(value)) {
    return date
  }

  const digits = value.replace('-', '').length
  if (digits < 10) {
    return date
  }

  const numeric = Number(value)
  return digits >= 11 ? numeric : numeric * 1000
}

/** 是否带明确偏移量（`Z` / `+08:00`），带偏移量的字符串表示确定时刻 */
const hasExplicitOffset = (date: string): boolean => /(?:z|[+-]\d{2}:?\d{2})$/i.test(date.trim())

/**
 * 在指定时区构建 dayjs 对象，时区非法或未指定时使用服务器时区
 *
 * - 时间戳 / Date / 带偏移量的字符串表示确定时刻，换算到目标时区（`format` 不参与解析）
 * - 不带偏移量的字符串按目标时区的本地时间解析，传 `format` 时按该格式解析
 */
export const dayjsTz = (
  date?: dayjs.ConfigType,
  timeZone?: string | null,
  format?: string,
): Dayjs => {
  const tz = resolveTimeZone(timeZone)
  const value = normalizeDate(date)

  // 带明确偏移量表示确定时刻，优先于 format（format 只用于解析不带偏移量的本地时间）
  if (typeof value === 'string' && hasExplicitOffset(value)) {
    return dayjs(value).tz(tz)
  }
  return format === undefined ? dayjs.tz(value, tz) : dayjs.tz(value, format, tz)
}

export type TimezonePluginOptions = {
  /** 默认时区，缺省或非法时回退到服务器时区 */
  defaultTimeZone?: string
}

/**
 * 时区插件：把请求时区注入 Context
 *
 * - `timeZone`：取自 `Time-Zone` 请求头，缺失或非法时为默认时区
 * - `dayjs`：按当前请求时区构建时间的函数，替代业务代码中的 `dayjs()`
 */
export const createTimezonePlugin = (options: TimezonePluginOptions = {}) => {
  const pluginTimeZone = resolveTimeZone(options.defaultTimeZone)

  // 响应头必须在 transform 阶段写入：Elysia 2 中 `derive` 在校验之后执行，
  // 校验失败时不会执行，会导致错误响应缺少 `Vary`
  return new Elysia({ name: 'timezone-plugin' })
    .onTransform('global', ({ set }) => {
      // 响应内容随时区变化，需告知缓存层按请求头区分
      set.headers['vary'] = mergeVaryHeader(set.headers['vary'], 'Time-Zone')
    })
    .derive('global', ({ request }) => {
      const timeZone = resolveTimeZone(request.headers.get(TIME_ZONE_HEADER), pluginTimeZone)

      return {
        timeZone,
        dayjs: (date?: dayjs.ConfigType, format?: string) => dayjsTz(date, timeZone, format),
      }
    })
}
