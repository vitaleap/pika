import { eq, and, desc, ilike, or, sql } from 'drizzle-orm'
import {
  userLoginLog,
  type DeviceType,
  type LoginType,
  type UserLoginLogInsert,
} from '@/system/schemas/user-login-log'
import { useDb } from '@/common/db'
import { escapeLike } from '@/system/utils/sql'
import dayjs from 'dayjs'

const isMobileDevice = (ua: string) => {
  const mobileRegex =
    /android|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|windows phone|phone|webos|kindle|tablet/i
  return mobileRegex.test(ua.toLowerCase())
}

const detectDeviceType = (userAgent: string): DeviceType => {
  const ua = userAgent.toLowerCase()
  if (ua.startsWith('app-android') || ua.startsWith('app-ios')) {
    return 'app'
  }
  if (
    ua.startsWith('desktop-windows') ||
    ua.startsWith('desktop-mac') ||
    ua.startsWith('desktop-linux')
  ) {
    return 'desktop'
  }
  if (isMobileDevice(ua)) {
    return 'h5'
  }
  return 'web'
}
export abstract class UserLoginLogRepository {
  static async save(data: Omit<UserLoginLogInsert, 'deviceType'>) {
    // device
    const res = await useDb()
      .insert(userLoginLog)
      .values({
        ...data,
        deviceType: detectDeviceType(data.userAgent),
      })
      .returning()
    if (res.length <= 0) {
      throw new Error('Failed to save login log')
    }
    return res[0]
  }

  static async list(params: {
    page: number
    pageSize: number
    keyword?: string
    success?: boolean
    loginType?: LoginType
  }) {
    const { page, pageSize, keyword, success, loginType } = params
    const pattern = keyword ? `%${escapeLike(keyword)}%` : undefined
    const where = and(
      pattern
        ? or(ilike(userLoginLog.username, pattern), ilike(userLoginLog.ip, pattern))
        : undefined,
      success !== undefined ? eq(userLoginLog.success, success) : undefined,
      loginType !== undefined ? eq(userLoginLog.loginType, loginType) : undefined,
    )

    const items = await useDb()
      .select()
      .from(userLoginLog)
      .where(where)
      // createAt 可能重复，追加唯一键保证 LIMIT/OFFSET 分页结果稳定
      .orderBy(desc(userLoginLog.createAt), desc(userLoginLog.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const [countRow] = await useDb()
      .select({ count: sql<number>`count(*)` })
      .from(userLoginLog)
      .where(where)

    return { items, total: Number(countRow?.count ?? 0) }
  }

  static async countRecentFailures(
    ip: string,
    username: string,
    minutes: number = 10,
  ): Promise<number> {
    const cutoff = dayjs().subtract(minutes, 'minute').toISOString()
    const result = await useDb()
      .select({ count: sql<number>`count(*)` })
      .from(userLoginLog)
      .where(
        and(
          eq(userLoginLog.ip, ip),
          eq(userLoginLog.username, username),
          eq(userLoginLog.success, false),
          sql`${userLoginLog.createAt} >= ${cutoff}`,
        ),
      )
    return Number(result[0]?.count ?? 0)
  }
}
