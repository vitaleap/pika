import { and, eq, isNull, lt, or, sql } from 'drizzle-orm'
import dayjs from 'dayjs'
import { useDb } from '@/common/db'
import {
  userMultiFactor,
  userMultiFactorLog,
  type MultiFactorType,
  type RecoveryCodeItem,
  type UserMultiFactorLogInsert,
} from '@/system/schemas/user-multi-factor'
import { loginFailReasons } from '@/system/schemas/user-login-log'

export abstract class UserMultiFactorRepository {
  static async listByUserId(userId: string) {
    return useDb().select().from(userMultiFactor).where(eq(userMultiFactor.userId, userId))
  }

  static async findByUserIdAndType(userId: string, type: MultiFactorType) {
    const [row] = await useDb()
      .select()
      .from(userMultiFactor)
      .where(and(eq(userMultiFactor.userId, userId), eq(userMultiFactor.type, type)))
      .limit(1)
    return row
  }

  /** 写入凭证，同类型已存在时覆盖（恢复码重新生成即整体替换） */
  static async save(
    userId: string,
    type: MultiFactorType,
    data: { secret?: string; codes?: RecoveryCodeItem[] },
  ): Promise<void> {
    await useDb()
      .insert(userMultiFactor)
      .values({ userId, type, ...data })
      .onConflictDoUpdate({
        target: [userMultiFactor.userId, userMultiFactor.type],
        set: data,
      })
  }

  /**
   * 记录 TOTP 已使用的时间步长，返回 false 表示该步长的验证码已被使用过（重放）。
   *
   * 用带条件的 UPDATE 实现「比较并写入」，避免并发校验时同一验证码被使用两次；
   * 条件里带上凭证行 `id`，校验期间凭证被重置并重建时更新命中 0 行，直接按重放处理。
   */
  static async useTotpCounter(factorId: string, counter: number): Promise<boolean> {
    const rows = await useDb()
      .update(userMultiFactor)
      .set({ lastUsedCounter: counter })
      .where(
        and(
          eq(userMultiFactor.id, factorId),
          or(isNull(userMultiFactor.lastUsedCounter), lt(userMultiFactor.lastUsedCounter, counter)),
        ),
      )
      .returning({ id: userMultiFactor.id })
    return rows.length > 0
  }

  static async remove(userId: string, type: MultiFactorType): Promise<void> {
    await useDb()
      .delete(userMultiFactor)
      .where(and(eq(userMultiFactor.userId, userId), eq(userMultiFactor.type, type)))
  }

  static async removeByUserId(userId: string): Promise<void> {
    await useDb().delete(userMultiFactor).where(eq(userMultiFactor.userId, userId))
  }

  static async saveLog(data: Omit<UserMultiFactorLogInsert, 'id' | 'createAt'>): Promise<void> {
    await useDb().insert(userMultiFactorLog).values(data)
  }

  /** 统计时间窗口内的验证失败次数，用于限制暴力尝试；重放已用过的验证码不计入 */
  static async countRecentFailures(userId: string, minutes: number): Promise<number> {
    const cutoff = dayjs().subtract(minutes, 'minute').toISOString()
    const [row] = await useDb()
      .select({ count: sql<number>`count(*)` })
      .from(userMultiFactorLog)
      .where(
        and(
          eq(userMultiFactorLog.userId, userId),
          eq(userMultiFactorLog.success, false),
          sql`${userMultiFactorLog.failReason} is distinct from ${loginFailReasons.multiFactorCodeUsed}`,
          sql`${userMultiFactorLog.createAt} >= ${cutoff}`,
        ),
      )
    return Number(row?.count ?? 0)
  }
}
