/**
 * Bun.RedisClient 支持的连接串协议，valkey 与 redis 协议互通。
 *
 * 用于判断缓存连接串是否走 Redis：命中则使用 Redis 缓存，否则视为文件缓存目录。
 */
const REDIS_PROTOCOLS = [
  'redis',
  'rediss',
  'valkey',
  'valkeys',
  'redis+tls',
  'redis+unix',
  'redis+tls+unix',
]

export const isRedisUrl = (url: string): boolean =>
  REDIS_PROTOCOLS.some((protocol) => url.startsWith(`${protocol}://`))
