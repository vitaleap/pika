import { and, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { user, type User, type UserInsert } from '@/system/schemas/user'
import { escapeLike } from '@/system/utils/sql'
import dayjs from 'dayjs'
import { useDb, withTransaction } from '@/common/db'
import { t } from '@/common/plugins/i18n'
import { userPreference } from '@/system/schemas/user-preference'
import { userMultiFactor } from '@/system/schemas/user-multi-factor'
import { HttpError } from '@pika/elysia-plugins'

export abstract class UserRepository {
  /**
   *
   * @param id 用户 id
   * @param errorStatus 如用户已注销或删除，错误码401触发重新登录，管理端等场景可传 404
   * @returns User
   */
  static async findByIdOrThrow(id: string, errorStatus = 401) {
    const row = await UserRepository.findById(id)
    if (!row) {
      throw new HttpError(t('SYSTEM.USER_NOT_FOUND'), errorStatus)
    }
    return row
  }

  static async list(params: {
    page: number
    pageSize: number
    keyword?: string
    emailVerified?: boolean
    phoneNumberVerified?: boolean
  }) {
    const { page, pageSize, keyword, emailVerified, phoneNumberVerified } = params
    const pattern = keyword ? `%${escapeLike(keyword)}%` : undefined
    const where = and(
      pattern
        ? or(
            ilike(user.name, pattern),
            ilike(user.email, pattern),
            ilike(user.phoneNumber, pattern),
          )
        : undefined,
      emailVerified !== undefined ? eq(user.emailVerified, emailVerified) : undefined,
      phoneNumberVerified !== undefined
        ? eq(user.phoneNumberVerified, phoneNumberVerified)
        : undefined,
    )

    const items = await useDb()
      .select()
      .from(user)
      .where(where)
      // createAt 可能重复，追加唯一键保证 LIMIT/OFFSET 分页结果稳定
      .orderBy(desc(user.createAt), desc(user.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const [countRow] = await useDb()
      .select({ count: sql<number>`count(*)` })
      .from(user)
      .where(where)

    return { items, total: Number(countRow?.count ?? 0) }
  }

  /**
   * 是否有用户
   * @returns bool
   */
  static async hasUser() {
    const [row] = await useDb()
      .select({
        id: user.id,
      })
      .from(user)
      .limit(1)
    return row !== undefined
  }

  static async findById(id: string) {
    const [row] = await useDb().select().from(user).where(eq(user.id, id)).limit(1)
    return row
  }

  static async findByEmail(email: string) {
    const [row] = await useDb().select().from(user).where(eq(user.email, email)).limit(1)
    return row
  }

  static async findByPhone(phone: string) {
    const [row] = await useDb().select().from(user).where(eq(user.phoneNumber, phone)).limit(1)
    return row
  }

  static async updateById(id: string, data: Partial<Omit<User, 'id' | 'createAt'>>) {
    await useDb().update(user).set(data).where(eq(user.id, id))
  }

  static async save(data: Omit<UserInsert, 'id'> & { createAt: dayjs.Dayjs }) {
    const [row] = await useDb().insert(user).values(data).returning()
    return row!
  }

  /**
   * 删除并清理关联数据
   * @param id 用户id
   */
  static async removeAndClearById(id: string) {
    await withTransaction(async (tx) => {
      await tx.delete(user).where(eq(user.id, id))
      await tx.delete(userPreference).where(eq(userPreference.userId, id))
      await tx.delete(userMultiFactor).where(eq(userMultiFactor.userId, id))
    })
  }
}
