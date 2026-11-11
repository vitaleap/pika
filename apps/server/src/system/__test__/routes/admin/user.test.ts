import dayjs from 'dayjs'
import { treaty } from '@elysia/eden'
import { type Api, startApp } from '@/app'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { UserRepository } from '@/system/repositories/user'
import { hashPassword } from '@/common/utils/crypto'

const adminEmail = 'admin-user-48527@gmail.com'
const targetEmail = 'target-user-48527@gmail.com'
const targetPhone = '13800000527'
// 不能与其它测试文件的手机号重复（user.phoneNumber 有唯一索引）
const newTargetPhone = '13800000627'
const password = 'Admin123456'

describe('adminUserRouter', () => {
  let appHandle!: Awaited<ReturnType<typeof startApp>>
  let api!: ReturnType<typeof treaty<Api>>
  let adminUserId!: string
  let targetUserId!: string
  let originalAdminEmail: string | undefined

  beforeAll(async () => {
    originalAdminEmail = process.env['ADMIN_EMAIL']
    process.env['ADMIN_EMAIL'] = adminEmail

    appHandle = await startApp({ port: 48527 })
    api = treaty<Api>(appHandle.baseUrl)

    for (const email of [adminEmail, targetEmail]) {
      const existing = await UserRepository.findByEmail(email).catch(() => null)
      if (existing) await UserRepository.removeById(existing.id).catch(() => {})
    }

    adminUserId = (
      await UserRepository.save({
        name: 'admin-user',
        email: adminEmail,
        emailVerified: true,
        password: await hashPassword(password),
        createAt: dayjs(),
      })
    ).id

    targetUserId = (
      await UserRepository.save({
        name: 'target-user',
        email: targetEmail,
        phoneNumber: targetPhone,
        password: await hashPassword(password),
        createAt: dayjs(),
      })
    ).id
  })

  afterAll(async () => {
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

  const login = async (username: string, loginPassword = password) => {
    const { data } = await api.system.oauth.token.post({
      grant_type: 'password',
      username,
      password: loginPassword,
    })
    expect(data).not.toBeNull()
    return data!.access_token
  }

  const listUsers = (accessToken?: string) =>
    api.system.admin.user.get({
      query: { page: 1, pageSize: 10 },
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    })

  test('列表接口仅管理员可访问', async () => {
    const { status: anonymousStatus } = await listUsers()
    expect(anonymousStatus).toBe(401)

    const userToken = await login(targetEmail)
    const { status: forbiddenStatus } = await listUsers(userToken)
    expect(forbiddenStatus).toBe(403)
  })

  test('管理员可分页查询用户且不返回密码', async () => {
    const adminToken = await login(adminEmail)
    const { data, status } = await listUsers(adminToken)
    expect(status).toBe(200)
    expect(data!.total).toBeGreaterThan(0)

    const target = data!.items.find((item) => item.id === targetUserId)
    expect(target).toBeDefined()
    expect(target).not.toHaveProperty('password')

    const { data: searched } = await api.system.admin.user.get({
      query: { page: 1, pageSize: 10, keyword: targetPhone },
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(searched!.items.some((item) => item.id === targetUserId)).toBe(true)
  })

  test('管理员可按邮箱与手机号验证状态筛选', async () => {
    const adminToken = await login(adminEmail)
    const headers = { Authorization: `Bearer ${adminToken}` }

    const { data: verifiedEmail } = await api.system.admin.user.get({
      query: { page: 1, pageSize: 10, keyword: adminEmail, emailVerified: true },
      headers,
    })
    expect(verifiedEmail!.items.some((item) => item.id === adminUserId)).toBe(true)

    const { data: unverifiedEmail } = await api.system.admin.user.get({
      query: { page: 1, pageSize: 10, keyword: adminEmail, emailVerified: false },
      headers,
    })
    expect(unverifiedEmail!.items.some((item) => item.id === adminUserId)).toBe(false)

    const { data: unverifiedPhone } = await api.system.admin.user.get({
      query: { page: 1, pageSize: 10, keyword: targetPhone, phoneNumberVerified: false },
      headers,
    })
    expect(unverifiedPhone!.items.some((item) => item.id === targetUserId)).toBe(true)

    const { data: verifiedPhone } = await api.system.admin.user.get({
      query: { page: 1, pageSize: 10, keyword: targetPhone, phoneNumberVerified: true },
      headers,
    })
    expect(verifiedPhone!.items.some((item) => item.id === targetUserId)).toBe(false)
  })

  test('搜索关键字中的 LIKE 通配符按字面量处理', async () => {
    const adminToken = await login(adminEmail)
    // 未转义时 % 会被当作通配符，命中所有以该前缀开头的手机号
    const keyword = `${targetPhone.slice(0, 7)}%`
    const { data, status } = await api.system.admin.user.get({
      query: { page: 1, pageSize: 10, keyword },
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(status).toBe(200)
    expect(data!.total).toBe(0)
  })

  test('管理员可全量更新用户信息并在未传字段时清空', async () => {
    const adminToken = await login(adminEmail)
    const headers = { Authorization: `Bearer ${adminToken}` }

    const { data, status } = await api.system.admin.user({ id: targetUserId }).put(
      {
        name: 'renamed-user',
        email: targetEmail,
        emailVerified: true,
        phoneNumberVerified: false,
      },
      { headers },
    )
    expect(status).toBe(200)
    expect(data!.name).toBe('renamed-user')
    expect(data!.email).toBe(targetEmail)
    expect(data!.emailVerified).toBe(true)
    // 未传 phoneNumber 视为清空
    expect(data!.phoneNumber).toBeUndefined()

    const { status: conflictStatus } = await api.system.admin.user({ id: targetUserId }).put(
      {
        name: 'renamed-user',
        email: adminEmail,
        emailVerified: true,
        phoneNumberVerified: false,
      },
      { headers },
    )
    expect(conflictStatus).toBe(409)
  })

  test('管理员更新手机号时校验格式', async () => {
    const adminToken = await login(adminEmail)
    const headers = { Authorization: `Bearer ${adminToken}` }

    const { status: invalidStatus } = await api.system.admin.user({ id: targetUserId }).put(
      {
        name: 'renamed-user',
        email: targetEmail,
        emailVerified: true,
        phoneNumber: '123456',
        phoneNumberVerified: false,
      },
      { headers },
    )
    expect(invalidStatus).toBe(422)

    const { data, status } = await api.system.admin.user({ id: targetUserId }).put(
      {
        name: 'renamed-user',
        email: targetEmail,
        emailVerified: true,
        phoneNumber: newTargetPhone,
        phoneNumberVerified: true,
      },
      { headers },
    )
    expect(status).toBe(200)
    expect(data!.phoneNumber).toBe(newTargetPhone)
  })

  test('管理员可通过独立接口重置用户密码', async () => {
    const adminToken = await login(adminEmail)
    const newPassword = 'Reset123456'

    const { status } = await api.system.admin
      .user({ id: targetUserId })
      .password.patch(
        { password: newPassword },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      )
    expect(status).toBe(200)

    const { status: loginStatus } = await api.system.oauth.token.post({
      grant_type: 'password',
      username: targetEmail,
      password: newPassword,
    })
    expect(loginStatus).toBe(200)
  })

  test('管理员重置密码同样要求包含字母和数字', async () => {
    const adminToken = await login(adminEmail)

    const { status } = await api.system.admin
      .user({ id: targetUserId })
      .password.patch(
        { password: '12345678' },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      )
    expect(status).toBe(422)
  })

  test('管理员更新邮箱时统一规范化为小写', async () => {
    const adminToken = await login(adminEmail)
    const mixedEmail = 'Target-User-Norm-48527@Gmail.com'
    const normalizedEmail = mixedEmail.toLowerCase()

    const { data, status } = await api.system.admin.user({ id: targetUserId }).put(
      {
        name: 'renamed-user',
        email: mixedEmail,
        emailVerified: true,
        phoneNumberVerified: false,
      },
      { headers: { Authorization: `Bearer ${adminToken}` } },
    )
    expect(status).toBe(200)
    expect(data!.email).toBe(normalizedEmail)

    const stored = await UserRepository.findByEmail(normalizedEmail)
    expect(stored?.id).toBe(targetUserId)
  })

  test('管理员更新邮箱时校验长度边界', async () => {
    const adminToken = await login(adminEmail)
    const headers = { Authorization: `Bearer ${adminToken}` }

    // 恰好等于 user.email 的 varchar(50) 容量
    const maxEmail = `${'a'.repeat(40)}@gmail.com`
    const { status: okStatus } = await api.system.admin
      .user({ id: targetUserId })
      .put(
        { name: 'renamed-user', email: maxEmail, emailVerified: true, phoneNumberVerified: false },
        { headers },
      )
    expect(okStatus).toBe(200)

    const tooLongEmail = `${'a'.repeat(41)}@gmail.com`
    const { status: failStatus } = await api.system.admin.user({ id: targetUserId }).put(
      {
        name: 'renamed-user',
        email: tooLongEmail,
        emailVerified: true,
        phoneNumberVerified: false,
      },
      { headers },
    )
    expect(failStatus).toBe(422)
  })

  test('管理员可更新注册流程生成的短用户名', async () => {
    const adminToken = await login(adminEmail)

    const { data, status } = await api.system.admin.user({ id: targetUserId }).put(
      {
        name: 'a',
        email: targetEmail,
        emailVerified: true,
        phoneNumberVerified: false,
      },
      { headers: { Authorization: `Bearer ${adminToken}` } },
    )
    expect(status).toBe(200)
    expect(data!.name).toBe('a')
  })

  test('管理员不能删除自己但可以删除其他用户', async () => {
    const adminToken = await login(adminEmail)
    const headers = { Authorization: `Bearer ${adminToken}` }

    const { status: selfStatus } = await api.system.admin
      .user({ id: adminUserId })
      .delete({}, { headers })
    expect(selfStatus).toBe(400)

    const { status: removeStatus } = await api.system.admin
      .user({ id: targetUserId })
      .delete({}, { headers })
    expect(removeStatus).toBe(200)
    expect(await UserRepository.findById(targetUserId)).toBeUndefined()
  })
})
