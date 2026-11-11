import { z } from 'zod'
import { zodBoolean, zodDayjs } from '@/common/zod'
import { i18n } from '@/common/plugins/i18n'
import { deviceTypes, loginTypes, type UserLoginLog } from '@/system/schemas/user-login-log'
import { UserLoginLogRepository } from '@/system/repositories/user-login-log'

type Locale = Parameters<typeof i18n.translate>[0]

const loginLogItemSchema = z.object({
  id: z.string(),
  userId: z.string().optional(),
  username: z.string(),
  ip: z.string(),
  deviceType: z.enum(deviceTypes),
  userAgent: z.string(),
  loginType: z.enum(loginTypes),
  success: z.boolean(),
  failReason: z.string().optional().describe('失败原因，已按请求语言翻译'),
  createAt: zodDayjs(),
})

export abstract class AdminLoginLogService {
  static ListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
    keyword: z.string().trim().min(1).max(50).optional(),
    success: zodBoolean().optional(),
    loginType: z.enum(loginTypes).optional(),
  })

  static ListRespSchema = z.object({
    items: z.array(loginLogItemSchema),
    total: z.number(),
  })

  private static toItem = (row: UserLoginLog, locale: Locale) => {
    return {
      id: row.id,
      userId: row.userId ?? undefined,
      username: row.username,
      ip: row.ip,
      deviceType: row.deviceType,
      userAgent: row.userAgent,
      loginType: row.loginType,
      success: row.success,
      failReason: row.failReason ? i18n.translate(locale, row.failReason) : undefined,
      createAt: row.createAt,
    }
  }

  static list = async (
    query: z.infer<typeof AdminLoginLogService.ListQuerySchema>,
    locale: Locale,
  ): Promise<z.infer<typeof AdminLoginLogService.ListRespSchema>> => {
    const { items, total } = await UserLoginLogRepository.list(query)
    return {
      items: items.map((item) => AdminLoginLogService.toItem(item, locale)),
      total,
    }
  }
}
