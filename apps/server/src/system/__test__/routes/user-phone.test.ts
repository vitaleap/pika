import dayjs from 'dayjs'
import { treaty } from '@elysia/eden'
import { type Api, startApp } from '@/app'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { cache } from '@/common/cache'
import { UserRepository } from '@/system/repositories/user'
import { SmsService } from '@/system/services/sms'
import { hashPassword } from '@/common/utils/crypto'

const boundEmail = 'edit-phone-bound-48529@gmail.com'
const boundPhone = '13800000529'
const unboundEmail = 'edit-phone-unbound-48529@gmail.com'
const newBoundPhone = '13800000729'
const newUnboundPhone = '13800000829'
const password = 'EditPhone123456'
const code = '123456'

describe('修改手机号', () => {
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

  const editPhone = (
    accessToken: string,
    data: { oldPhone?: string; newPhone: string; oldCode?: string; newCode: string },
  ) =>
    api.system.user.edit.phone.post(data, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

  beforeAll(async () => {
    appHandle = await startApp({ port: 48529 })
    api = treaty<Api>(appHandle.baseUrl)

    for (const email of [boundEmail, unboundEmail]) {
      const existing = await UserRepository.findByEmail(email).catch(() => null)
      if (existing) await UserRepository.removeById(existing.id).catch(() => {})
    }

    boundUserId = (
      await UserRepository.save({
        name: 'edit-phone-bound',
        email: boundEmail,
        emailVerified: true,
        phoneNumber: boundPhone,
        phoneNumberVerified: true,
        password: await hashPassword(password),
        createAt: dayjs(),
      })
    ).id

    unboundUserId = (
      await UserRepository.save({
        name: 'edit-phone-unbound',
        email: unboundEmail,
        emailVerified: true,
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
      [boundPhone, newBoundPhone, newUnboundPhone].map((phone) =>
        cache.del(`${SmsService.KEY_PREFIX}${phone}`),
      ),
    )
  })

  test('未绑定手机号时无需旧手机号与旧验证码即可直接绑定', async () => {
    const accessToken = await login(unboundEmail)
    await cache.set(`${SmsService.KEY_PREFIX}${newUnboundPhone}`, code, 60)

    const { data, status } = await editPhone(accessToken, {
      // 未绑定手机号时旧手机号与旧验证码应被忽略
      oldPhone: '13900000000',
      oldCode: '000000',
      newPhone: newUnboundPhone,
      newCode: code,
    })
    expect(status).toBe(200)
    expect(data!.success).toBe(true)

    const user = await UserRepository.findById(unboundUserId)
    expect(user?.phoneNumber).toBe(newUnboundPhone)
    expect(user?.phoneNumberVerified).toBe(true)
    expect(await cache.get(`${SmsService.KEY_PREFIX}${newUnboundPhone}`)).toBeUndefined()
  })

  test('已绑定手机号时缺少旧验证码则拒绝修改', async () => {
    const accessToken = await login(boundPhone)

    const { status, error } = await editPhone(accessToken, {
      newPhone: newBoundPhone,
      newCode: code,
    })
    expect(status).toBe(400)
    expect((error?.value as { message?: string })?.message).toBe('请先验证旧手机号')

    const user = await UserRepository.findById(boundUserId)
    expect(user?.phoneNumber).toBe(boundPhone)
  })

  test('已绑定手机号时校验通过后可修改手机号', async () => {
    const accessToken = await login(boundPhone)
    await Promise.all([
      cache.set(`${SmsService.KEY_PREFIX}${boundPhone}`, code, 60),
      cache.set(`${SmsService.KEY_PREFIX}${newBoundPhone}`, code, 60),
    ])

    const { data, status } = await editPhone(accessToken, {
      oldPhone: boundPhone,
      oldCode: code,
      newPhone: newBoundPhone,
      newCode: code,
    })
    expect(status).toBe(200)
    expect(data!.success).toBe(true)

    const user = await UserRepository.findById(boundUserId)
    expect(user?.phoneNumber).toBe(newBoundPhone)
    expect(await cache.get(`${SmsService.KEY_PREFIX}${boundPhone}`)).toBeUndefined()
    expect(await cache.get(`${SmsService.KEY_PREFIX}${newBoundPhone}`)).toBeUndefined()
  })
})
