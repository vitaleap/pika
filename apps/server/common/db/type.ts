import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres'
import type { PgliteDatabase } from 'drizzle-orm/pglite'
import type { PgAsyncDatabase } from 'drizzle-orm/pg-core/async/db'
import type { PgAsyncTransaction } from 'drizzle-orm/pg-core/async/session'
import type { PgQueryResultHKT } from 'drizzle-orm/pg-core/session'
import type { EmptyRelations } from 'drizzle-orm/relations'
import type { PGlite } from '@electric-sql/pglite'

/** 对外统一类型，避免两个 driver 的 union 推导 */
export type Db = PgAsyncDatabase<PgQueryResultHKT, EmptyRelations>
export type Tx = PgAsyncTransaction<PgQueryResultHKT, EmptyRelations>
/** 对业务暴露的执行器：不允许直接开事务，事务统一走 withTransaction */
export type DbExecutor = Omit<Db, 'transaction'>

/** 内部类型，保留 $client 供 closeDb 使用 */
export type DbWithClient =
  | (BunSQLDatabase & {
      $client: Bun.SQL
    })
  | (PgliteDatabase & {
      $client: PGlite
    })
