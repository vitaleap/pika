import { snakeCase } from 'drizzle-orm/pg-core'
import { baseColumns } from '@/common/db/base/columns'

export const deviceTypes = ['web', 'h5', 'app', 'desktop'] as const
export type DeviceType = (typeof deviceTypes)[number]

export const loginTypes = ['password', 'email_code', 'phone_code', 'refresh_token'] as const
export type LoginType = (typeof loginTypes)[number]

/**
 * 登录失败原因，数据库只存 i18n key，接口返回时按请求语言翻译。
 * 历史数据为中文原文，翻译时找不到对应 key 会原样返回。
 */
export const loginFailReasons = {
  userNotFound: 'SYSTEM.USER_NOT_FOUND',
  passwordIncorrect: 'SYSTEM.PASSWORD_INCORRECT',
  verificationCodeIncorrect: 'SYSTEM.VERIFICATION_CODE_INCORRECT',
} as const
export type LoginFailReason = (typeof loginFailReasons)[keyof typeof loginFailReasons]

export const userLoginLog = snakeCase.table('user_login_log', (t) => ({
  ...baseColumns(t),
  userId: t.varchar({ length: 20 }),
  username: t.varchar({ length: 50 }).notNull(),
  ip: t.varchar({ length: 50 }).notNull(),
  deviceType: t
    .varchar({
      length: 20,
      enum: deviceTypes,
    })
    .notNull(),
  // web/h5 like browser user-agent, other like [uaDevice]/[version] seem app-ios/version
  // device can be app-android, app-ios, desktop-windows, desktop-mac, desktop-linux
  userAgent: t.varchar({ length: 1024 }).notNull(),
  loginType: t
    .varchar({
      length: 20,
      enum: loginTypes,
    })
    .notNull(),
  success: t.boolean().notNull(),
  failReason: t.varchar({ length: 255 }).$type<LoginFailReason>(),
}))

export type UserLoginLog = typeof userLoginLog.$inferSelect
export type UserLoginLogInsert = typeof userLoginLog.$inferInsert
