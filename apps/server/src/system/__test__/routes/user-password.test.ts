import dayjs from 'dayjs'
import { eq } from 'drizzle-orm'
import { treaty } from '@elysia/eden'
import { type Api, startApp } from '@/app'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { useDb } from '@/common/db'
import { UserRepository } from '@/system/repositories/user'
import { UserMultiFactorRepository } from '@/system/repositories/user-multi-factor'
import { userMultiFactor } from '@/system/schemas/user-multi-factor'
import { hashPassword, verifyPassword } from '@/common/utils/crypto'
import { generateTotp } from '@/common/utils/totp'

const password = 'UserPassword123456'

describe('修改密码', () => {
  let appHandle!: Awaited<ReturnType<typeof startApp>>
  let api!: ReturnType<typeof treaty<Api>>

  /** 每个 describe 建独立用户，避免按用例名单独运行时依赖前序用例 */
  const createUser = async (email: string) => {
    const existing = await UserRepository.findByEmail(email).catch(() => null)
    if (existing) await UserRepository.removeById(existing.id).catch(() => {})

    const user = await UserRepository.save({
      name: 'user-password',
      email,
      emailVerified: true,
      password: await hashPassword(password),
      createAt: dayjs(),
    })
    const { data } = await api.system.oauth.token.post({
      grant_type: 'password',
      username: email,
      password,
    })
    return { userId: user.id, headers: { Authorization: `Bearer ${data!.access_token}` } }
  }

  const removeUser = async (userId: string) => {
    await UserMultiFactorRepository.removeByUserId(userId).catch(() => {})
    await UserRepository.removeById(userId).catch(() => {})
  }

  beforeAll(async () => {
    appHandle = await startApp({ port: 48535 })
    api = treaty<Api>(appHandle.baseUrl)
  })

  afterAll(async () => {
    await appHandle.app.stop()
  })

  describe('未绑定验证方式', () => {
    const email = 'user-password-48535@gmail.com'
    let userId!: string
    let headers!: { Authorization: string }
    /** 当前生效的密码，随用例推进变化 */
    let currentPassword = password

    const changePassword = (data: { oldPassword: string; newPassword: string }) =>
      api.system.user.password.patch(data, { headers })

    const login = (pwd: string) =>
      api.system.oauth.token.post({ grant_type: 'password', username: email, password: pwd })

    const savedPassword = async () => (await UserRepository.findById(userId))?.password ?? ''

    beforeAll(async () => {
      ;({ userId, headers } = await createUser(email))
    })

    afterAll(async () => {
      if (userId) await removeUser(userId)
    })

    test('未登录无法访问', async () => {
      const { status } = await api.system.user.password.patch({
        oldPassword: password,
        newPassword: 'UserPassword654321',
      })
      expect(status).toBe(401)
    })

    test('旧密码错误时拒绝修改', async () => {
      const { status, error } = await changePassword({
        oldPassword: 'Wrong123456',
        newPassword: 'UserPassword654321',
      })
      expect(status).toBe(400)
      expect((error?.value as { message?: string })?.message).toBe('旧密码不正确')
      // 失败后密码保持不变
      expect(await verifyPassword(password, await savedPassword())).toBe(true)
    })

    test('新密码不满足强度要求', async () => {
      const { status } = await changePassword({
        oldPassword: currentPassword,
        newPassword: '123456',
      })
      expect(status).toBe(422)
    })

    test('新密码不能与旧密码相同', async () => {
      const { status, error } = await changePassword({
        oldPassword: currentPassword,
        newPassword: currentPassword,
      })
      expect(status).toBe(400)
      expect((error?.value as { message?: string })?.message).toBe('新密码不能与旧密码相同')
    })

    test('修改成功后旧密码失效、新密码可登录', async () => {
      const newPassword = 'UserPassword654321'
      const { data, status } = await changePassword({
        oldPassword: currentPassword,
        newPassword,
      })
      expect(status).toBe(200)
      expect(data).toEqual({ success: true })

      expect(await verifyPassword(currentPassword, await savedPassword())).toBe(false)
      expect(await verifyPassword(newPassword, await savedPassword())).toBe(true)

      const { status: loginStatus } = await login(newPassword)
      expect(loginStatus).toBe(200)
      currentPassword = newPassword
    })
  })

  describe('已绑定验证方式', () => {
    const email = 'user-password-mfa-48535@gmail.com'
    let userId!: string
    let headers!: { Authorization: string }
    let secret!: string
    const currentPassword = password

    const changePassword = (data: { oldPassword: string; newPassword: string }) =>
      api.system.user.password.patch(data, { headers })

    const savedPassword = async () => (await UserRepository.findById(userId))?.password ?? ''

    /**
     * 动态码有防重放保护，同一时间步长只能使用一次。
     * 绑定验证方式与后续修改密码都要校验，需清空已使用步长。
     */
    const resetUsedCounter = () =>
      useDb()
        .update(userMultiFactor)
        .set({ lastUsedCounter: null })
        .where(eq(userMultiFactor.userId, userId))

    beforeAll(async () => {
      ;({ userId, headers } = await createUser(email))
      const { data } = await api.system['multi-factor'].totp.setup.post({}, { headers })
      secret = data!.secret
      await api.system['multi-factor'].totp.confirm.post(
        { code: generateTotp(secret) },
        { headers },
      )
    })

    afterAll(async () => {
      if (userId) await removeUser(userId)
    })

    test('缺少第二因素会被拒绝', async () => {
      const { status, error } = await changePassword({
        oldPassword: currentPassword,
        newPassword: 'UserPassword111111',
      })
      expect(status).toBe(400)
      // 前端拦截该错误码后弹出安全验证，再带上校验结果重试
      expect((error?.value as { data?: { mfaTypes?: string[] } })?.data?.mfaTypes).toEqual(['totp'])
      expect(await verifyPassword(currentPassword, await savedPassword())).toBe(true)
    })

    test('提供第二因素后可修改密码', async () => {
      await resetUsedCounter()

      const { status } = await api.system.user.password.patch(
        {
          oldPassword: currentPassword,
          newPassword: 'UserPassword111111',
          mfaType: 'totp',
          mfaValue: generateTotp(secret),
        },
        { headers },
      )
      expect(status).toBe(200)
      expect(await verifyPassword('UserPassword111111', await savedPassword())).toBe(true)
    })
  })
})
