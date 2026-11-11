import { cache } from '@/common/cache'
import { HookOrder, onShutdown, onStartBefore } from '@pika/elysia-hook'
import { log } from '@/common/log'
import { closeDb, runMigrate } from '@/common/db'
import { UserRepository } from '@/system/repositories/user'
import { join } from 'node:path'

onStartBefore(
  async () => {
    await cache.lock('db-migrate', async () => {
      const isTest = Bun.env.NODE_ENV === 'test'
      log.info('[hook/db] start to run database migration...')
      try {
        await runMigrate(
          isTest
            ? {
                // 若是测试环境，通过 dir 计算 drizzle 位置，解决不管使用vscode的调试按钮，还是任意位置执行 bun test，都能成功找到 db drizzle
                migrationsFolder: join(import.meta.dir, '../../drizzle'),
              }
            : undefined,
        )
        await UserRepository.findById('0')
      } catch (e: any) {
        log.error(
          { error: 'message' in e ? e.message : String(e) },
          '[hook/db] database migration error',
        )
        console.error(e)
        await Bun.sleep(50)
        process.exit(1)
      }
      log.info('[hook/db] database migration completed.')
    })
  },
  // 晚于 snowflake hook of HookOrder.First
  HookOrder.First + 1,
)

onShutdown(async () => {
  try {
    await closeDb()
  } catch {}
  log.info('[hook/db] database connection closed.')
})
