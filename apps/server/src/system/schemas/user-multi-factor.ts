import { index, snakeCase, uniqueIndex } from 'drizzle-orm/pg-core'
import { baseColumns, jsonType } from '@/common/db/base/columns'

/** 多因素类型：身份验证器（TOTP）与恢复码 */
export const multiFactorTypes = ['totp', 'recovery_code'] as const
export type MultiFactorType = (typeof multiFactorTypes)[number]

/** 单条恢复码记录，仅保存摘要 */
export type RecoveryCodeItem = {
  /** 恢复码的 SHA-256 摘要 */
  hash: string
  /** 使用时间，未使用时为空 */
  usedAt?: string
}

/**
 * 用户多因素凭证，一个用户每种类型最多一条记录。
 * - `totp`：`secret` 保存 AES 加密后的 TOTP 密钥，`lastUsedCounter` 记录已使用的时间步长
 * - `recovery_code`：`codes` 保存恢复码摘要列表，使用后标记 `usedAt`
 */
export const userMultiFactor = snakeCase.table(
  'user_multi_factor',
  (t) => ({
    ...baseColumns(t),
    userId: t.varchar({ length: 20 }).notNull(),
    type: t.varchar({ length: 20, enum: multiFactorTypes }).notNull(),
    secret: t.varchar({ length: 255 }),
    /** 恢复码摘要列表，使用后标记 `usedAt`；仅 `recovery_code` 类型有值 */
    codes: jsonType<RecoveryCodeItem[]>(),
    /** 最近一次校验通过的 TOTP 时间步长，用于拒绝同一验证码的重复使用 */
    lastUsedCounter: t.integer(),
  }),
  (t) => [uniqueIndex('user_multi_factor_user_id_type_idx').on(t.userId, t.type)],
)

/**
 * 多因素验证日志。
 * - 失败日志用于失败次数限制与安全审计
 * - 成功日志用于安全审计
 */
export const userMultiFactorLog = snakeCase.table(
  'user_multi_factor_log',
  (t) => ({
    ...baseColumns(t),
    userId: t.varchar({ length: 20 }).notNull(),
    type: t.varchar({ length: 20, enum: multiFactorTypes }).notNull(),
    ip: t.varchar({ length: 50 }).notNull(),
    userAgent: t.varchar({ length: 1024 }).notNull(),
    success: t.boolean().notNull(),
    failReason: t.varchar({ length: 255 }),
  }),
  (t) => [index('user_multi_factor_log_user_id_create_at_idx').on(t.userId, t.createAt)],
)

export type UserMultiFactor = typeof userMultiFactor.$inferSelect
export type UserMultiFactorInsert = typeof userMultiFactor.$inferInsert
export type UserMultiFactorLog = typeof userMultiFactorLog.$inferSelect
export type UserMultiFactorLogInsert = typeof userMultiFactorLog.$inferInsert
