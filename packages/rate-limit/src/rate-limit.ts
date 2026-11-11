/**
 * 限流错误。超限时抛出，调用方应转换为对应的 HTTP 错误类。
 */
export class RateLimitError extends Error {
  override name = 'RateLimitError'
  status: number
  detail?: string

  constructor(message: string, status: number = 429, detail?: string) {
    super(message)
    this.status = status
    this.detail = detail
  }
}

export type RateLimitCache = {
  get<T>(key: string): Promise<T | undefined>
  /** 返回值被忽略，使用 `Promise<unknown>` 以兼容链式 API（如 `@seepine/cache`） */
  set<T>(key: string, value: T, ttlSeconds: number): Promise<unknown>
}

export type RateLimitOptions = {
  /** 1 秒窗口内允许最大请求次数（0 或未设置表示忽略该窗口） */
  second?: number
  /** 60 秒窗口内允许最大请求次数 */
  minute?: number
  /** 600 秒（10 分钟）窗口内允许最大请求次数 */
  minute10?: number
  /** 3600 秒窗口内允许最大请求次数 */
  hour?: number
  /** 86400 秒窗口内允许最大请求次数 */
  day?: number
  /** 超限时响应 message 字段；未设置使用 `'Too Many Requests'`。推荐传入 i18n token */
  errorMessage?: string
}

const WINDOW_SECONDS = {
  second: 1,
  minute: 60,
  minute10: 60 * 10,
  hour: 60 * 60,
  day: 60 * 60 * 24,
} as const

const WINDOW_KEYS = ['second', 'minute', 'minute10', 'hour', 'day'] as const

const DEFAULT_ERROR_MESSAGE = 'Too Many Requests'

const recordAndCount = async (
  cache: RateLimitCache,
  cacheKey: string,
  seconds: number,
): Promise<number> => {
  const now = Math.floor(Date.now() / 1000)
  const data = (await cache.get<Record<number, number>>(cacheKey)) || {}
  data[now] = (data[now] || 0) + 1
  let count = 0
  const newData: Record<number, number> = {}
  for (let i = now - seconds + 1; i <= now; i++) {
    const c = data[i] || 0
    if (c > 0) {
      count += c
      newData[i] = c
    }
  }
  await cache.set(cacheKey, newData, seconds + 1)
  return count
}

/**
 * 多窗口限流 helper。
 *
 * 不依赖任何 web 框架；超限时抛出 `RateLimitError`（默认 429）。
 * 调用方负责 catch 并转换为对应框架的错误类型。
 *
 * `second` / `minute` / `minute10` / `hour` / `day` 全部可选：
 * - 未设置或等于 0：忽略该窗口
 * - 小于 0：立即抛错
 *
 * @example
 * ```ts
 * await rateLimit(cache, {
 *   second: 10,
 *   minute: 20,
 *   minute10: 50,
 *   hour: 50,
 *   day: 100,
 *   errorMessage: t('REQUEST_RATE_LIMITED'),
 * }, `send_code:${requestIp}`)
 * ```
 */
export const rateLimit = async (
  cache: RateLimitCache,
  opts: RateLimitOptions,
  key: string,
): Promise<void> => {
  for (const label of WINDOW_KEYS) {
    const max = opts[label]
    if (max === undefined || max === 0) {
      continue
    }
    if (max < 0) {
      throw new Error(`rateLimit: '${label}' must be >= 0, got ${max}`)
    }
    const count = await recordAndCount(cache, `rate-limit:${key}:${label}`, WINDOW_SECONDS[label])
    if (count > max) {
      throw new RateLimitError(opts.errorMessage ?? DEFAULT_ERROR_MESSAGE, 429)
    }
  }
}

/**
 * 单窗口限流 helper，返回当前 key 在窗口内的累计请求次数。
 * 由调用方决定是否超限。
 *
 * @example
 * ```ts
 * const times = await getRateLimitTimes(cache, `captcha:${requestIp}`, 10)
 * if (times > 10) throw new Error('Too Many Requests')
 * ```
 */
export const getRateLimitTimes = (
  cache: RateLimitCache,
  key: string,
  seconds: number = 10,
): Promise<number> => recordAndCount(cache, `rate-limit:${key}`, seconds)
