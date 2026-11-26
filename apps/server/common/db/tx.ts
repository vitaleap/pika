import { AsyncLocalStorage } from 'node:async_hooks'
import { sql } from 'drizzle-orm'
import type { PgTransactionConfig } from 'drizzle-orm/pg-core/session'
import { config } from '@/common/config'
import { log } from '@/common/log'
import { isPostgresUrl } from '@/common/utils/is'
import { requireDb } from './client'
import type { Db, DbExecutor, Tx } from './type'

declare global {
  var _dbTx: AsyncLocalStorage<Tx> | undefined
}

/** 事务上下文，挂在 globalThis 上以便热重载后复用 */
const txStorage = (globalThis._dbTx ??= new AsyncLocalStorage<Tx>())

/**
 * 正在执行嵌套事务的父事务。
 * savepoint 作用于整条连接，同一父事务下并发执行的兄弟会共用一条连接，
 * 一方的 `ROLLBACK TO SAVEPOINT` 会连带撤销另一方的写入，因此必须串行。
 */
const busyParentTx = new WeakSet<object>()

/**
 * 获取数据库执行器：事务内自动返回当前事务，事务外返回数据库连接。
 * 刻意不暴露 `transaction`，避免 `useDb().transaction()` 静默丢失事务上下文。
 */
export const useDb = (): DbExecutor => txStorage.getStore() ?? requireDb()

const RETRYABLE_SQL_STATES = new Set(['40001', '40P01'])

/** SQLSTATE 固定为 5 位数字/大写字母，用于排除驱动自有错误码（如 ERR_POSTGRES_SERVER_ERROR） */
const SQLSTATE_RE = /^[0-9A-Z]{5}$/

/**
 * 沿 cause 链取 SQLSTATE。
 * Bun.SQL 把协议错误码放在 `errno`（`code` 是 Bun 自有错误码），PGlite 则直接放在 `code`，
 * 而 drizzle 会把驱动错误包一层 `DrizzleQueryError`，因此需要逐层比对。
 */
const getSqlState = (error: unknown): string | undefined => {
  let current = error as { code?: unknown; errno?: unknown; cause?: unknown } | undefined
  while (current) {
    for (const candidate of [current.errno, current.code]) {
      if (typeof candidate === 'string' && SQLSTATE_RE.test(candidate)) {
        return candidate
      }
    }
    current = current.cause as typeof current
  }
  return undefined
}

export type TransactionOptions = PgTransactionConfig & {
  /** 可重试错误（40001/40P01）的重试次数，必须是非负整数，默认 0；开启后 fn 必须可重放，事务内不要有外部副作用 */
  retries?: number
  /**
   * 语句超时（毫秒），必须是正整数，仅 PostgreSQL 生效。
   * PGlite 接受该 GUC 但不会真正中断查询（无信号机制），因此跳过。
   */
  timeoutMs?: number
}

/**
 * 在事务中执行，回调内所有 `useDb()` 自动落到该事务。
 * 已处于事务中时降级为 savepoint，避免 PGlite 单连接下嵌套事务死锁。
 *
 * 注意：
 * - `options` 只对最外层事务生效，嵌套调用时会被忽略并告警。
 * - 同一父事务下的嵌套调用必须串行（`Promise.all` 会被拒绝），
 *   因为 savepoint 作用于整条连接，并发兄弟的语句会交错，回滚会互相误伤。
 */
export const withTransaction = async <T>(
  fn: (tx: DbExecutor) => Promise<T>,
  options: TransactionOptions = {},
): Promise<T> => {
  // 校验先于嵌套分支，避免同一非法入参在嵌套路径下被静默忽略
  const { retries = 0, timeoutMs, ...txConfig } = options
  if (!Number.isInteger(retries) || retries < 0) {
    throw new Error(`[db] retries 必须是非负整数，收到 ${retries}`)
  }
  if (timeoutMs !== undefined && (!Number.isInteger(timeoutMs) || timeoutMs <= 0)) {
    throw new Error(`[db] timeoutMs 必须是正整数（毫秒），收到 ${timeoutMs}`)
  }

  const current = txStorage.getStore()
  if (current) {
    // savepoint 上无法设置隔离级别，重试也会让外层事务处于失败态，只能忽略
    if (Object.keys(options).length > 0) {
      log.warn({ options }, '[db] nested withTransaction ignores options')
    }
    if (busyParentTx.has(current)) {
      throw new Error(
        '[db] 同一父事务下不允许并发嵌套 withTransaction（savepoint 会互相回滚），请改为顺序执行',
      )
    }
    busyParentTx.add(current)
    try {
      return await current.transaction((tx) => txStorage.run(tx, () => fn(tx)))
    } finally {
      busyParentTx.delete(current)
    }
  }

  for (let attempt = 0; ; attempt++) {
    const start = Date.now()
    try {
      // 收窄为统一类型，避免两个 driver 的 tx 签名合并
      const db: Db = requireDb()
      const result = await db.transaction(async (tx) => {
        if (timeoutMs && isPostgresUrl(config.databaseUrl)) {
          await tx.execute(sql.raw(`SET LOCAL statement_timeout = ${timeoutMs}`))
        }
        return txStorage.run(tx, () => fn(tx))
      }, txConfig)

      const cost = Date.now() - start
      if (cost > 500) {
        log.warn({ cost }, '[db] slow transaction')
      }
      return result
    } catch (error) {
      const state = getSqlState(error)
      if (attempt >= retries || state === undefined || !RETRYABLE_SQL_STATES.has(state)) {
        throw error
      }
      log.warn({ state, attempt }, '[db] retry transaction')
      await Bun.sleep(50 * 2 ** attempt + Math.random() * 50)
    }
  }
}
