import { eq } from 'drizzle-orm'
import { useDb } from '@/common/db'
import { userPreference, type UserPreferenceInsert } from '@/system/schemas/user-preference'

export abstract class UserPreferenceRepository {
  static async findByUserId(userId: string) {
    const [row] = await useDb()
      .select()
      .from(userPreference)
      .where(eq(userPreference.userId, userId))
      .limit(1)
    return row
  }

  /**
   * 按用户维度写入偏好（整体覆盖 appearance）。
   *
   * 使用 upsert 而非「先查后写」，避免并发保存时双方都判定为无记录而插入，
   * 触发 `user_id` 唯一约束报错。
   */
  static async save(userId: string, data: Pick<UserPreferenceInsert, 'appearance'>): Promise<void> {
    await useDb()
      .insert(userPreference)
      .values({ userId, ...data })
      .onConflictDoUpdate({ target: userPreference.userId, set: data })
  }

  static async removeByUserId(userId: string): Promise<void> {
    await useDb().delete(userPreference).where(eq(userPreference.userId, userId))
  }
}
