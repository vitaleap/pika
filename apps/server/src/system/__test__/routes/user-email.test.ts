import dayjs from 'dayjs'
import { treaty } from '@elysia/eden'
import { type Api, startApp } from '@/app'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { cache } from '@/common/cache'
import { UserRepository } from '@/system/repositories/user'
import { EmailService } from '@/system/services/email'
import { hashPassword } from '@/common/utils/crypto'

const boundEmail = 'edit-email-bound-48528@gmail.com'
const boundPhone = '13800000528'
const unboundPhone = '13800000628'
const newBoundEmail = 'edit-email-bound-new-48528@gmail.com'
const newUnboundEmail = 'edit-email-unbound-new-48528@gmail.com'
const password = 'EditEmail123456'
const code = '123456'

describe('修改邮箱', () => {
  let appHandle!: Awaited<ReturnType<typeof startApp>>
  let api!: ReturnType<typeof treaty<Api>>
  let boundUserId!: string
  let unboundUserId!: string

  const login = async (username: string) => {
    const { data } = await api.system.oauth.token.post({
      grant_type: 'password',
      username,
      password,
    })
    return data!.access_token
  }

  const editEmail = (
    accessToken: string,
    data: { oldEmail?: string; newEmail: string; oldCode?: string; newCode: string },
  ) =>
    api.system.user.edit.email.post(data, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

  beforeAll(async () => {
    appHandle = await startApp({ port: 48528 })
    api = treaty<Api>(appHandle.baseUrl)

    for (const phone of [boundPhone, unboundPhone]) {
      const existing = await UserRepository.findByPhone(phone).catch(() => null)
      if (existing) await UserRepository.removeById(existing.id).catch(() => {})
    }

    boundUserId = (
      await UserRepository.save({
        name: 'edit-email-bound',
        email: boundEmail,
        emailVerified: true,
        phoneNumber: boundPhone,
        password: await hashPassword(password),
        createAt: dayjs(),
      })
    ).id

    unboundUserId = (
      await UserRepository.save({
        name: 'edit-email-unbound',
        phoneNumber: unboundPhone,
        password: await hashPassword(password),
        createAt: dayjs(),
      })
    ).id
  })

  afterAll(async () => {
    await appHandle.app.stop()
    for (const id of [boundUserId, unboundUserId]) {
      if (id) await UserRepository.removeById(id).catch(() => {})
    }
    await Promise.all(
      [boundEmail, newBoundEmail, newUnboundEmail].map((email) =>
        cache.del(`${EmailService.KEY_PREFIX}${email}`),
      ),
    )
  })

  test('未绑定邮箱时无需旧邮箱与旧验证码即可直接绑定', async () => {
    const accessToken = await login(unboundPhone)
    await cache.set(`${EmailService.KEY_PREFIX}${newUnboundEmail}`, code, 60)

    const { data, status } = await editEmail(accessToken, {
      // 未绑定邮箱时旧邮箱与旧验证码应被忽略
      oldEmail: 'not-bound-48528@gmail.com',
      oldCode: '000000',
      newEmail: newUnboundEmail,
      newCode: code,
    })
    expect(status).toBe(200)
    expect(data!.success).toBe(true)

    const user = await UserRepository.findById(unboundUserId)
    expect(user?.email).toBe(newUnboundEmail)
    expect(user?.emailVerified).toBe(true)
    expect(await cache.get(`${EmailService.KEY_PREFIX}${newUnboundEmail}`)).toBeUndefined()
  })

  test('已绑定邮箱时缺少旧验证码则拒绝修改', async () => {
    const accessToken = await login(boundPhone)

    const { status, error } = await editEmail(accessToken, {
      newEmail: newBoundEmail,
      newCode: code,
    })
    expect(status).toBe(400)
    expect((error?.value as { message?: string })?.message).toBe('请先验证旧邮箱')

    const user = await UserRepository.findById(boundUserId)
    expect(user?.email).toBe(boundEmail)
  })

  test('已绑定邮箱时校验通过后可修改邮箱', async () => {
    const accessToken = await login(boundPhone)
    await Promise.all([
      cache.set(`${EmailService.KEY_PREFIX}${boundEmail}`, code, 60),
      cache.set(`${EmailService.KEY_PREFIX}${newBoundEmail}`, code, 60),
    ])

    const { data, status } = await editEmail(accessToken, {
      oldEmail: boundEmail,
      oldCode: code,
      newEmail: newBoundEmail,
      newCode: code,
    })
    expect(status).toBe(200)
    expect(data!.success).toBe(true)

    const user = await UserRepository.findById(boundUserId)
    expect(user?.email).toBe(newBoundEmail)
    expect(await cache.get(`${EmailService.KEY_PREFIX}${boundEmail}`)).toBeUndefined()
    expect(await cache.get(`${EmailService.KEY_PREFIX}${newBoundEmail}`)).toBeUndefined()
  })
})
