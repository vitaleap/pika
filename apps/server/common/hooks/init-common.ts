import { HookOrder, onShutdown, onStartBefore } from '@pika/elysia-hook'
import { snowflake } from '@/common/snowflake'
import { cache } from '@/common/cache'

// 无外部依赖的基础设施初始化，先于其他所有钩子
onStartBefore(async () => {
  await snowflake.init()
}, HookOrder.First)

// 无外部依赖的基础设施，程序退出后清理资源，晚于所有钩子
onShutdown(async () => {
  try {
    await snowflake.cleanup()
  } catch {}
  try {
    await cache.close()
  } catch {}
}, HookOrder.Last)
