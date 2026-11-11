import { config } from '@/common/config'
import { clusterRun } from '@/common/utils/cluster'
import { isPostgresUrl } from '@/common/utils/is-postgres-url'
import { isRedisUrl } from '@/common/utils/is-redis-url'

// PGlite 为嵌入式数据库，多进程启动会带来迁移与写入竞争
const isPostgres = isPostgresUrl(config.databaseUrl)
const isRedis = isRedisUrl(config.cacheUrl)
// 仅当生产环境+pgsql+redis+显式开启，才使用多进程模式
if (config.mode !== 'production' || !isPostgres || !isRedis || !config.multiProcessModeEnabled) {
  await (await import('./app')).startApp()
} else {
  clusterRun(async () => {
    await (await import('./app')).startApp()
  })
}
