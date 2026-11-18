import { snowflake } from '@/common/snowflake'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { sql } from 'drizzle-orm'
import { customType } from 'drizzle-orm/pg-core'
import type { PgColumnsBuilders } from 'drizzle-orm/pg-core/columns/all'

const getCurrentDayjs = () => {
  if (!globalThis.ctx) {
    return dayjs
  }
  const safe = globalThis.ctx.safeGet('dayjs')
  return safe.success ? safe.data : dayjs
}

const getCurrentUserId = () => {
  const defaultVal = sql<null>`NULL`
  if (!globalThis.ctx) {
    return defaultVal
  }
  const safe = globalThis.ctx.safeGet('user')
  if (!safe.success) {
    return defaultVal
  }
  if (!safe.data.sub) {
    return defaultVal
  }
  return safe.data.sub
}

// 自定义 Dayjs 类型
export const dayjsType = customType<{
  data: Dayjs
  driverData: string
}>({
  dataType() {
    return 'varchar(30)'
  },
  toDriver(value: Dayjs): string {
    return value.toISOString()
  },
  fromDriver(value: string): Dayjs {
    return getCurrentDayjs()(value)
  },
})

/**
 * JSON 类型：以 text 存 JSON 文本，读写时自动序列化/反序列化，不依赖具体数据库的 json 类型。
 * SQL NULL 与 undefined 由 drizzle 在驱动层短路，不会进入 toDriver/fromDriver。
 */
export const jsonType = <T>() =>
  customType<{
    data: T
    driverData: string
  }>({
    dataType: () => 'text',
    toDriver: (value: T) => JSON.stringify(value),
    fromDriver: (value: string) => JSON.parse(value) as T,
  })()

export const baseColumns = (t: PgColumnsBuilders) => ({
  id: t
    .varchar({ length: 20 })
    .primaryKey()
    .notNull()
    .$defaultFn(() => snowflake.nextId()),
  createAt: dayjsType()
    .$defaultFn(() => getCurrentDayjs()())
    .notNull(),
  createId: t.varchar().$defaultFn(() => getCurrentUserId()),
  updateAt: dayjsType()
    .$defaultFn(() => getCurrentDayjs()())
    .$onUpdateFn(() => getCurrentDayjs()())
    .notNull(),
  updateId: t
    .varchar()
    .$defaultFn(() => sql<null>`NULL`)
    .$onUpdateFn(() => getCurrentUserId()),
})
