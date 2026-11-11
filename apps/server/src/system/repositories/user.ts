import { and, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { user, type User, type UserInsert } from '@/system/schemas/user'
import { escapeLike } from '@/system/utils/sql'
import dayjs from 'dayjs'
import { useDb } from '@/common/db'

export abstract class UserRepository {
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

  static async removeById(id: string) {
    await useDb().delete(user).where(eq(user.id, id))
  }
}
