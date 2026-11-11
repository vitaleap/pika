import {
  RateLimitError,
  type RateLimitOptions,
  rateLimit as rateLimitHelper,
} from '@pika/rate-limit'
import { HttpError } from '@pika/elysia-plugins'
import { cache } from './cache'

/**
 * 多窗口限流便捷版本（已绑定 server cache，将 `RateLimitError` 转换为 `HttpError`）。
 *
 * @example
 * ```ts
 * await rateLimit({ second: 10, minute: 20, hour: 50, day: 100 }, `send_code:${requestIp}`)
 * ```
 */
export const rateLimit = async (opts: RateLimitOptions, key: string): Promise<void> => {
  try {
    await rateLimitHelper(cache, opts, key)
  } catch (e) {
    if (e instanceof RateLimitError) {
      throw new HttpError(e.message, e.status, e.detail)
    }
    throw e
  }
}
