import dayjs from 'dayjs'
import { inArray } from 'drizzle-orm'
import { treaty } from '@elysia/eden'
import { type Api, startApp } from '@/app'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { useDb } from '@/common/db'
import { UserRepository } from '@/system/repositories/user'
import { UserLoginLogRepository } from '@/system/repositories/user-login-log'
import { userLoginLog, loginFailReasons } from '@/system/schemas/user-login-log'
import { hashPassword } from '@/common/utils/crypto'

const adminEmail = 'admin-login-log-48531@gmail.com'
const targetEmail = 'target-login-log-48531@gmail.com'
const password = 'Admin123456'
// 日志用例专用用户名与 IP，避免与其他用例的数据互相干扰
const logUsername = 'login-log-user-48531'
const logIp = '10.99.99.31'
const webUserAgent =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0 Safari/537.36'

const cleanLoginLogs = () =>
  useDb()
    .delete(userLoginLog)
    .where(inArray(userLoginLog.username, [logUsername, adminEmail, targetEmail]))

describe('adminLoginLogRouter', () => {
  let appHandle!: Awaited<ReturnType<typeof startApp>>
  let api!: ReturnType<typeof treaty<Api>>
  let adminUserId!: string
  let targetUserId!: string
  let originalAdminEmail: string | undefined

  beforeAll(async () => {
    originalAdminEmail = process.env['ADMIN_EMAIL']
    process.env['ADMIN_EMAIL'] = adminEmail

    appHandle = await startApp({ port: 48531 })
    api = treaty<Api>(appHandle.baseUrl)

    await cleanLoginLogs()
    for (const email of [adminEmail, targetEmail]) {
      const existing = await UserRepository.findByEmail(email).catch(() => null)
      if (existing) await UserRepository.removeById(existing.id).catch(() => {})
    }

    adminUserId = (
      await UserRepository.save({
        name: 'admin-login-log',
        email: adminEmail,
        emailVerified: true,
        password: await hashPassword(password),
        createAt: dayjs(),
      })
    ).id

    targetUserId = (
      await UserRepository.save({
        name: 'target-login-log',
        email: targetEmail,
        emailVerified: true,
        password: await hashPassword(password),
        createAt: dayjs(),
      })
    ).id

    await UserLoginLogRepository.save({
      username: logUsername,
      userId: targetUserId,
      ip: logIp,
      userAgent: webUserAgent,
      loginType: 'password',
      success: true,
    })
    await UserLoginLogRepository.save({
      username: logUsername,
      userId: targetUserId,
      ip: logIp,
      userAgent: webUserAgent,
      loginType: 'password',
      success: false,
      failReason: loginFailReasons.passwordIncorrect,
    })
  })

  afterAll(async () => {
    await cleanLoginLogs()
    for (const id of [adminUserId, targetUserId]) {
      if (id) await UserRepository.removeById(id).catch(() => {})
    }
    await appHandle.app.stop()
    if (originalAdminEmail === undefined) {
      delete process.env['ADMIN_EMAIL']
    } else {
      process.env['ADMIN_EMAIL'] = originalAdminEmail
    }
  })

  const login = async (username: string) => {
    const { data } = await api.system.oauth.token.post({
      grant_type: 'password',
      username,
      password,
    })
    expect(data).not.toBeNull()
    return data!.access_token
  }

  const listLogs = (
    query: {
      page: number
      pageSize: number
      keyword?: string
      success?: boolean
      loginType?: 'password' | 'email_code' | 'phone_code' | 'refresh_token'
    },
    accessToken?: string,
    acceptLanguage?: string,
  ) => {
    const headers: Record<string, string> = {}
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
    if (acceptLanguage) headers['Accept-Language'] = acceptLanguage
    return api.system.admin['login-log'].get({
      query,
      headers,
    })
  }

  test('列表接口仅管理员可访问', async () => {
    const { status: anonymousStatus } = await listLogs({ page: 1, pageSize: 10 })
    expect(anonymousStatus).toBe(401)

    const userToken = await login(targetEmail)
    const { status: forbiddenStatus } = await listLogs({ page: 1, pageSize: 10 }, userToken)
    expect(forbiddenStatus).toBe(403)
  })

  test('管理员可分页查询登录日志', async () => {
    const adminToken = await login(adminEmail)
    const { data, status } = await listLogs(
      { page: 1, pageSize: 10, keyword: logUsername },
      adminToken,
    )
    expect(status).toBe(200)
    expect(data!.total).toBe(2)

    const [latest] = data!.items
    expect(latest!.username).toBe(logUsername)
    expect(latest!.ip).toBe(logIp)
    expect(latest!.deviceType).toBe('web')
    expect(latest!.loginType).toBe('password')
    // 最新的日志排在前面
    expect(latest!.success).toBe(false)
    // 失败原因存 i18n key，返回时按请求语言翻译
    expect(latest!.failReason).toBe('密码不正确')
  })

  test('失败原因按 Accept-Language 返回对应语言', async () => {
    const adminToken = await login(adminEmail)
    const { data, status } = await listLogs(
      { page: 1, pageSize: 10, keyword: logUsername },
      adminToken,
      'en-US,en;q=0.9',
    )
    expect(status).toBe(200)
    expect(data!.items[0]!.failReason).toBe('Incorrect password')
  })

  test('管理员可按登录结果与登录方式筛选', async () => {
    const adminToken = await login(adminEmail)

    const { data: failed } = await listLogs(
      { page: 1, pageSize: 10, keyword: logUsername, success: false },
      adminToken,
    )
    expect(failed!.total).toBe(1)
    expect(failed!.items[0]!.success).toBe(false)

    const { data: succeeded } = await listLogs(
      { page: 1, pageSize: 10, keyword: logUsername, success: true },
      adminToken,
    )
    expect(succeeded!.total).toBe(1)
    expect(succeeded!.items[0]!.success).toBe(true)

    const { data: byIp } = await listLogs(
      { page: 1, pageSize: 10, keyword: logIp, loginType: 'password' },
      adminToken,
    )
    expect(byIp!.total).toBe(2)

    const { data: otherType } = await listLogs(
      { page: 1, pageSize: 10, keyword: logIp, loginType: 'email_code' },
      adminToken,
    )
    expect(otherType!.total).toBe(0)
  })

  test('搜索关键字中的 LIKE 通配符按字面量处理', async () => {
    const adminToken = await login(adminEmail)
    // 未转义时 % 会被当作通配符，命中所有以该前缀开头的用户名
    const keyword = `${logUsername.slice(0, 8)}%`
    const { data, status } = await listLogs({ page: 1, pageSize: 10, keyword }, adminToken)
    expect(status).toBe(200)
    expect(data!.total).toBe(0)
  })
})
