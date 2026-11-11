import dayjs from 'dayjs'
import { treaty } from '@elysia/eden'
import { type Api, startApp } from '@/app'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { UserRepository } from '@/system/repositories/user'
import { hashPassword } from '@/common/utils/crypto'

const email = 'check-avail-48530@gmail.com'
const phone = '13800000530'
const otherEmail = 'check-avail-other-48530@gmail.com'
const otherPhone = '13800000630'
const unusedEmail = 'check-avail-unused-48530@gmail.com'
const unusedPhone = '13800000730'
const password = 'Check123456'

describe('邮箱与手机号验重', () => {
  let appHandle!: Awaited<ReturnType<typeof startApp>>
  let api!: ReturnType<typeof treaty<Api>>
  let userId!: string
  let otherUserId!: string

  const login = async (username: string) => {
    const { data } = await api.system.oauth.token.post({
      grant_type: 'password',
      username,
      password,
    })
    return data!.access_token
  }

  const authHeaders = async (username: string) => ({
    Authorization: `Bearer ${await login(username)}`,
  })

  beforeAll(async () => {
    appHandle = await startApp({ port: 48530 })
    api = treaty<Api>(appHandle.baseUrl)

    for (const value of [email, otherEmail]) {
      const existing = await UserRepository.findByEmail(value).catch(() => null)
      if (existing) await UserRepository.removeById(existing.id).catch(() => {})
    }

    userId = (
      await UserRepository.save({
        name: 'check-avail',
        email,
        emailVerified: true,
        phoneNumber: phone,
        phoneNumberVerified: true,
        password: await hashPassword(password),
        createAt: dayjs(),
      })
    ).id

    otherUserId = (
      await UserRepository.save({
        name: 'check-avail-other',
        email: otherEmail,
        emailVerified: true,
        phoneNumber: otherPhone,
        phoneNumberVerified: true,
        password: await hashPassword(password),
        createAt: dayjs(),
      })
    ).id
  })

  afterAll(async () => {
    await appHandle.app.stop()
    for (const id of [userId, otherUserId]) {
      if (id) await UserRepository.removeById(id).catch(() => {})
    }
  })

  test('未登录时拒绝验重', async () => {
    const { status } = await api.system.user.check.email.post({ email: otherEmail })
    expect(status).toBe(401)
  })

  test('自己的邮箱与手机号视为可用', async () => {
    const headers = await authHeaders(email)

    const emailRes = await api.system.user.check.email.post({ email }, { headers })
    expect(emailRes.status).toBe(200)
    expect(emailRes.data!.available).toBe(true)

    const phoneRes = await api.system.user.check.phone.post({ phone }, { headers })
    expect(phoneRes.status).toBe(200)
    expect(phoneRes.data!.available).toBe(true)
  })

  test('他人已使用的邮箱与手机号不可用', async () => {
    const headers = await authHeaders(email)

    const emailRes = await api.system.user.check.email.post({ email: otherEmail }, { headers })
    expect(emailRes.data!.available).toBe(false)

    const phoneRes = await api.system.user.check.phone.post({ phone: otherPhone }, { headers })
    expect(phoneRes.data!.available).toBe(false)
  })

  test('未使用的邮箱与手机号可用', async () => {
    const headers = await authHeaders(email)

    const emailRes = await api.system.user.check.email.post({ email: unusedEmail }, { headers })
    expect(emailRes.data!.available).toBe(true)

    const phoneRes = await api.system.user.check.phone.post({ phone: unusedPhone }, { headers })
    expect(phoneRes.data!.available).toBe(true)
  })

  test('手机号格式非法时拒绝验重', async () => {
    const headers = await authHeaders(email)
    const { status } = await api.system.user.check.phone.post({ phone: '123456' }, { headers })
    expect(status).toBe(422)
  })

  test('10 分钟内超过 20 次验重请求返回 429', async () => {
    // 使用独立账号，避免与上方用例共享限流计数
    const headers = await authHeaders(otherEmail)
    for (let i = 0; i < 20; i++) {
      const { status } = await api.system.user.check.email.post({ email: unusedEmail }, { headers })
      expect(status).toBe(200)
    }

    const { status } = await api.system.user.check.email.post({ email: unusedEmail }, { headers })
    expect(status).toBe(429)
  })
})
