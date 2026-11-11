import { drizzle as bunDriver, BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres'
import { migrate as bunMigrate } from 'drizzle-orm/bun-sql/migrator'
import { PgliteDatabase, drizzle as pgliteDriver } from 'drizzle-orm/pglite'
import { migrate as pgliteMigrate } from 'drizzle-orm/pglite/migrator'
import type { PGlite } from '@electric-sql/pglite'
import { config } from '@/common/config'
import { log } from '@/common/log'
import { embedPath } from '@/common/utils/embed-assets'
import { isPostgresUrl } from '@/common/utils/is-postgres-url'
import { createPGlite } from '@/common/db/plugins/pglite'
import type { MigrationConfig } from 'drizzle-orm/migrator'

type Db =
  | (BunSQLDatabase & {
      $client: Bun.SQL
    })
  | (PgliteDatabase & {
      $client: PGlite
    })
  | undefined

declare global {
  var _db: Promise<Db> | undefined
}

const createDb = async (): Promise<Db> => {
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

const db = await globalThis._db

export const useDb = () => {
  if (db === undefined) {
    throw new Error('DATABASE_URL env is required')
  }
  return db
}

export const closeDb = async () => {
  // 热重载触发的 shutdown 不真正关闭连接，供下一次热重载复用
  if (globalThis.__is_hot__) {
    return
  }

  await useDb().$client.close()
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
  const db = useDb()
  const config = {
    ...migrationConfig,
    ...cfg,
  }
  if (db instanceof BunSQLDatabase) {
    await bunMigrate(db, config)
  } else if (db instanceof PgliteDatabase) {
    await pgliteMigrate(db, config)
  }
}
