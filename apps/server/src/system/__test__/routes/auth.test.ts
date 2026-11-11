import dayjs from 'dayjs'
import { inArray } from 'drizzle-orm'
import { treaty } from '@elysia/eden'
import { type Api, startApp } from '@/app'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { cache } from '@/common/cache'
import { useDb } from '@/common/db'
import { UserRepository } from '@/system/repositories/user'
import { ConfigService } from '@/system/services/config'
import { userLoginLog } from '@/system/schemas/user-login-log'
import { EmailService } from '@/system/services/email'
import { SmsService } from '@/system/services/sms'
import { hashPassword } from '@/common/utils/crypto'

const phone = '13800000525'
const email = 'code-login-48525@gmail.com'
const password = 'CodeLogin123456'
const code = '123456'
// 限流用例专用账号，避免与其他用例共享失败计数
const limitedPhone = '13800000625'
const missingPhone = '13800000725'
// 注册用例专用账号，避免与登录用例互相干扰
const registerPhone = '13800000825'
const registerEmail = 'code-login-48526@gmail.com'

const cleanLoginLogs = () => {
  return useDb()
    .delete(userLoginLog)
    .where(inArray(userLoginLog.username, [phone, email, limitedPhone, missingPhone]))
}

// update 的 auth 是整体配置对象，需先读出再覆盖 regType；走 Service 以同步失效配置缓存
const setRegType = async (regType: 'email' | 'phone') => {
  const { auth } = await ConfigService.get()
  await ConfigService.update({ auth: { ...auth, regType } })
}

describe('登录与 Token', () => {
  let appHandle!: Awaited<ReturnType<typeof startApp>>
  let api!: ReturnType<typeof treaty<Api>>
  let userId!: string

  beforeAll(async () => {
    appHandle = await startApp({ port: 48525 })
    api = treaty<Api>(appHandle.baseUrl)

    // 清理残留用户和日志，避免唯一键冲突及限流干扰
    await cleanLoginLogs()
    for (const existing of await Promise.all([
      UserRepository.findByPhone(phone),
      UserRepository.findByEmail(email),
      UserRepository.findByPhone(registerPhone),
    ])) {
      if (existing) {
        await UserRepository.removeById(existing.id)
      }
    }

    const user = await UserRepository.save({
      name: 'code-login',
      email,
      phoneNumber: phone,
      password: await hashPassword(password),
      createAt: dayjs(),
    })
    userId = user.id
  })

  afterAll(async () => {
    await appHandle.app.stop()
    // 恢复默认注册方式，避免影响其他测试文件
    await setRegType('email')
    if (userId) {
      await UserRepository.removeById(userId).catch(() => {})
    }
    await cleanLoginLogs()
    const registerUser = await UserRepository.findByPhone(registerPhone)
    if (registerUser) {
      await UserRepository.removeById(registerUser.id).catch(() => {})
    }
    await Promise.all([
      cache.del(`${SmsService.KEY_PREFIX}${phone}`),
      cache.del(`${EmailService.KEY_PREFIX}${email}`),
      cache.del(`${SmsService.KEY_PREFIX}${registerPhone}`),
    ])
  })

  test('手机号格式非法时拒绝请求', async () => {
    const { status: loginStatus } = await api.system.oauth.token.post({
      grant_type: 'phone_code',
      phone: '123456',
      code,
    })
    expect(loginStatus).toBe(422)

    const { status: sendCodeStatus } = await api.system.oauth.send.code.post({
      channel: 'phone',
      phone: '23800000525',
      uniqueId: '1',
    })
    expect(sendCodeStatus).toBe(422)
  })

  test('注册方式与请求类型不匹配时拒绝注册', async () => {
    await setRegType('email')
    const phoneRes = await api.system.oauth.reg.phone.post({
      phone: registerPhone,
      password,
      code,
    })
    expect(phoneRes.status).toBe(400)
    expect((phoneRes.error?.value as { message?: string })?.message).toBe('当前仅支持邮箱注册')

    await setRegType('phone')
    const emailRes = await api.system.oauth.reg.email.post({
      email: registerEmail,
      password,
      code,
    })
    expect(emailRes.status).toBe(400)
    expect((emailRes.error?.value as { message?: string })?.message).toBe('当前仅支持手机号注册')
  })

  test('手机号注册时昵称默认为手机号后 6 位', async () => {
    await setRegType('phone')
    await cache.set(`${SmsService.KEY_PREFIX}${registerPhone}`, code, 60)
    const { status } = await api.system.oauth.reg.phone.post({
      phone: registerPhone,
      password,
      code,
    })
    expect(status).toBe(200)

    const user = await UserRepository.findByPhone(registerPhone)
    expect(user?.name).toBe('000825')
    // 注册成功后消费验证码，避免在有效期内被重放
    expect(await cache.get(`${SmsService.KEY_PREFIX}${registerPhone}`)).toBeUndefined()
  })

  test('手机验证码登录成功并删除已用验证码', async () => {
    await cache.set(`${SmsService.KEY_PREFIX}${phone}`, code, 60)
    const { data, status } = await api.system.oauth.token.post({
      grant_type: 'phone_code',
      phone,
      code,
    })
    expect(status).toBe(200)
    expect(data?.access_token).toBeString()
    expect(data?.refresh_token).toBeString()
    expect(await cache.get(`${SmsService.KEY_PREFIX}${phone}`)).toBeUndefined()
  })

  test('邮箱验证码登录成功且邮箱大小写不敏感', async () => {
    await cache.set(`${EmailService.KEY_PREFIX}${email}`, code, 60)
    const { data, status } = await api.system.oauth.token.post({
      grant_type: 'email_code',
      email: email.toUpperCase(),
      code,
    })
    expect(status).toBe(200)
    expect(data?.access_token).toBeString()
  })

  test('验证码错误时不签发 token 且保留验证码', async () => {
    await cache.set(`${SmsService.KEY_PREFIX}${phone}`, code, 60)
    const { status, error } = await api.system.oauth.token.post({
      grant_type: 'phone_code',
      phone,
      code: '000000',
    })
    expect(status).not.toBe(200)
    expect((error?.value as { message?: string })?.message).toBe('验证码错误')
    expect(await cache.get<string>(`${SmsService.KEY_PREFIX}${phone}`)).toBe(code)
  })

  test('用户不存在时返回与验证码错误相同的文案，避免账号枚举', async () => {
    const { status, error } = await api.system.oauth.token.post({
      grant_type: 'phone_code',
      phone: missingPhone,
      code,
    })
    expect(status).toBe(401)
    expect((error?.value as { message?: string })?.message).toBe('验证码错误')
  })

  test('连续失败达到上限后返回 429', async () => {
    for (let i = 0; i < 5; i++) {
      await api.system.oauth.token.post({
        grant_type: 'phone_code',
        phone: limitedPhone,
        code,
      })
    }
    const { status } = await api.system.oauth.token.post({
      grant_type: 'phone_code',
      phone: limitedPhone,
      code,
    })
    expect(status).toBe(429)
  })

  test('密码登录签发 token 并可通过 userinfo 获取用户信息', async () => {
    const { data: tokenInfo, status } = await api.system.oauth.token.post({
      grant_type: 'password',
      username: email,
      password,
    })
    expect(status).toBe(200)
    expect(tokenInfo).toContainAllKeys([
      'access_token',
      'refresh_token',
      'token_type',
      'expires_in',
    ])

    const { data: userinfo } = await api.system.oauth.userinfo.get({
      headers: { Authorization: `Bearer ${tokenInfo!.access_token}` },
    })
    expect(userinfo?.sub).toBe(userId)
    expect(userinfo?.name).toBe('code-login')
  })

  test('Refresh Token 只能通过 /oauth/token 的 POST Body 使用', async () => {
    const { data: tokenInfo } = await api.system.oauth.token.post({
      grant_type: 'password',
      username: email,
      password,
    })
    const refreshToken = tokenInfo!.refresh_token

    const { status: userInfoStatus } = await api.system.oauth.userinfo.get({
      headers: { Authorization: `Bearer ${refreshToken}` },
    })
    expect(userInfoStatus).toBe(401)

    const { status: headerRefreshStatus } = await api.system.oauth.token.post(
      {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      },
      {
        headers: { Authorization: `Bearer ${refreshToken}` },
      },
    )
    expect(headerRefreshStatus).toBe(401)

    const { data: refreshedTokenInfo, status: refreshStatus } = await api.system.oauth.token.post({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    })
    expect(refreshStatus).toBe(200)
    expect(refreshedTokenInfo?.access_token).toBeString()

    const { status: refreshedAccessStatus } = await api.system.oauth.userinfo.get({
      headers: { Authorization: `Bearer ${refreshedTokenInfo!.access_token}` },
    })
    expect(refreshedAccessStatus).toBe(200)
  })
})
