import { Cache } from '@seepine/cache'
import { BunRedisAdapter } from '@seepine/cache/adapt/bun'
import { FileAdapter } from '@seepine/cache/adapt/file'
import { config } from './config'
import { isRedisUrl } from './utils/is-redis-url'
import { resolvePath } from './utils/path'

// CACHE_URL 为 memory 时走内存缓存，为 redis/valkey 连接串时走 Redis，其他值视为文件缓存目录
const createAdapter = () => {
  if (config.cacheUrl === 'memory' || config.cacheUrl === '') return undefined
  return isRedisUrl(config.cacheUrl)
    ? new BunRedisAdapter(config.cacheUrl)
    : new FileAdapter(resolvePath(config.cacheUrl))
}

export const cache = new Cache({ adapter: createAdapter() })
