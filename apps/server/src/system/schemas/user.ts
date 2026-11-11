import { snakeCase } from 'drizzle-orm/pg-core'
import { baseColumns, dayjsType } from '@/common/db/base/columns'

export const user = snakeCase.table('user', (t) => ({
  ...baseColumns(t),
  name: t.varchar({ length: 50 }).notNull(),
  email: t.varchar({ length: 50 }).unique(),
  emailVerified: t.boolean().default(false).notNull(),
  phoneNumber: t.varchar({ length: 20 }).unique(),
  phoneNumberVerified: t.boolean().default(false).notNull(),
  password: t.varchar({ length: 255 }),
  picture: t.varchar({ length: 500 }),
  loginAt: dayjsType(),
}))

export type User = typeof user.$inferSelect
export type UserInsert = typeof user.$inferInsert
