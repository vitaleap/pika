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
