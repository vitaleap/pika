import { drizzle as bunDriver, BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres'
import { migrate as bunMigrate } from 'drizzle-orm/bun-sql/migrator'
import { PgliteDatabase, drizzle as pgliteDriver } from 'drizzle-orm/pglite'
import { migrate as pgliteMigrate } from 'drizzle-orm/pglite/migrator'
import type { MigrationConfig } from 'drizzle-orm/migrator'
import { config } from '@/common/config'
import { log } from '@/common/log'
import { embedPath } from '@/common/utils/embed-assets'
import { isPostgresUrl } from '@/common/utils/is'
import { createPGlite } from '@/common/db/plugins/pglite'
import type { DbWithClient } from './type'

declare global {
  var _db: Promise<DbWithClient | undefined> | undefined
}

const createDb = async (): Promise<DbWithClient | undefined> => {
  if (!config.databaseUrl) {
    log.info('DATABASE_URL env not found')
    return undefined
  }

  // 统一使用 postgresql://，避免 postgres:// 被当作 PGlite 数据目录而静默启动
  if (config.databaseUrl.startsWith('postgres://')) {
    throw new Error('DATABASE_URL 不支持 postgres:// 前缀，请使用 postgresql://')
  }

  if (isPostgresUrl(config.databaseUrl)) {
    return bunDriver(config.databaseUrl)
  }

  const client = await createPGlite(config.databaseUrl)
  return pgliteDriver({ client })
}

if (globalThis._db === undefined) {
  globalThis._db = createDb().catch((error) => {
    globalThis._db = undefined
    throw error
  })
}

let db = await globalThis._db

/** 获取真实连接；事务内也不会返回 tx */
export const requireDb = (): DbWithClient => {
  if (db === undefined) {
    throw new Error('DATABASE_URL env is required')
  }
  return db
}

/** 连接被关闭后重新创建，供测试环境在每个用例文件结束时真正关闭后复用 */
const ensureDb = async (): Promise<DbWithClient> => {
  if (db === undefined) {
    globalThis._db = createDb().catch((error) => {
      globalThis._db = undefined
      throw error
    })
    db = await globalThis._db
  }
  return requireDb()
}

export const closeDb = async () => {
  // 热重载触发的 shutdown 不真正关闭连接，供下一次热重载复用
  if (globalThis.__is_hot__ && Bun.env.NODE_ENV !== 'test') {
    return
  }
  await db?.$client.close()
  db = undefined
  globalThis._db = undefined
}

const migrationConfig: MigrationConfig = {
  migrationsFolder: embedPath('./drizzle'),
  // 放置于 public 表，避免迁移漏了
  migrationsSchema: 'public',
  // 固定表名，避免后续版本变更出错
  migrationsTable: '__drizzle_migrations',
}

export const runMigrate = async (cfg?: MigrationConfig) => {
  // 迁移必须使用真实连接，不能走事务上下文
  const migrationDb = await ensureDb()
  const migrationCfg: MigrationConfig = {
    ...migrationConfig,
    ...cfg,
  }
  if (migrationDb instanceof BunSQLDatabase) {
    await bunMigrate(migrationDb, migrationCfg)
  } else if (migrationDb instanceof PgliteDatabase) {
    await pgliteMigrate(migrationDb, migrationCfg)
  }
}
