import dayjs from 'dayjs'
import { and, desc, eq } from 'drizzle-orm'
import { treaty } from '@elysia/eden'
import { type Api, startApp } from '@/app'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { useDb } from '@/common/db'
import { cache } from '@/common/cache'
import { EmailService } from '@/system/services/email'
import { UserRepository } from '@/system/repositories/user'
import { UserMultiFactorRepository } from '@/system/repositories/user-multi-factor'
import { userMultiFactor, userMultiFactorLog } from '@/system/schemas/user-multi-factor'
import { userLoginLog } from '@/system/schemas/user-login-log'
import { hashPassword } from '@/common/utils/crypto'
import { generateTotp } from '@/common/utils/totp'

const email = 'multi-factor-48534@gmail.com'
const lockEmail = 'multi-factor-lock-48534@gmail.com'
const adminEmail = 'multi-factor-admin-48534@gmail.com'
const password = 'MultiFactor123456'
/** 默认登录设备 */
const deviceA = 'test-device-a'
/** 另一台设备，用于验证多因素校验 */
const deviceB = 'test-device-b'

type Verify = { type: 'totp' | 'recovery_code'; value: string }

describe('多因素验证', () => {
  let appHandle!: Awaited<ReturnType<typeof startApp>>
  let api!: ReturnType<typeof treaty<Api>>
  let userId!: string
  let lockUserId!: string
  let adminUserId!: string
  let originalAdminEmail: string | undefined
  let accessToken!: string
  let secret!: string
  let recoveryCodes: string[] = []

  const authHeaders = () => ({ Authorization: `Bearer ${accessToken}` })
  const mfa = () => api.system['multi-factor']
  const totpVerify = (): Verify => ({ type: 'totp', value: generateTotp(secret) })

  /** 多因素校验字段，与后端所有需要第二因素的接口保持一致 */
  const mfaFields = (verify?: Verify) =>
    verify ? { mfaType: verify.type, mfaValue: verify.value } : {}

  /**
   * 动态码有防重放保护，同一时间步长只能使用一次。
   * 测试需要连续校验时先清空已使用步长，避免相互影响。
   */
  const resetUsedCounter = () =>
    useDb()
      .update(userMultiFactor)
      .set({ lastUsedCounter: null })
      .where(eq(userMultiFactor.userId, userId))

  /** 清空失败日志，避免前序用例的故意失败计入失败次数限制 */
  const clearFailureLogs = () =>
    useDb().delete(userMultiFactorLog).where(eq(userMultiFactorLog.userId, userId))

  const login = (verify?: Verify, userAgent = deviceA) =>
    api.system.oauth.token.post(
      {
        grant_type: 'password',
        username: email,
        password,
        ...mfaFields(verify),
      },
      { headers: { 'user-agent': userAgent } },
    )

  /** 读取最近一条登录失败日志的失败原因，用于校对日志与实际错误是否一致 */
  const latestLoginFailReason = async (id: string) => {
    const [row] = await useDb()
      .select()
      .from(userLoginLog)
      .where(and(eq(userLoginLog.userId, id), eq(userLoginLog.success, false)))
      .orderBy(desc(userLoginLog.createAt))
      .limit(1)
    return row?.failReason
  }

  /** 完整走一遍身份验证器绑定流程（未绑定任何验证方式时无需校验） */
  const bindTotp = async (token: string) => {
    const headers = { Authorization: `Bearer ${token}` }
    const { data: setup } = await mfa().totp.setup.post({}, { headers })
    await mfa().totp.confirm.post({ code: generateTotp(setup!.secret) }, { headers })
    return setup!.secret
  }

  beforeAll(async () => {
    originalAdminEmail = process.env['ADMIN_EMAIL']
    process.env['ADMIN_EMAIL'] = adminEmail

    appHandle = await startApp({ port: 48534 })
    api = treaty<Api>(appHandle.baseUrl)

    for (const item of [email, lockEmail, adminEmail]) {
      const existing = await UserRepository.findByEmail(item).catch(() => null)
      if (existing) await UserRepository.removeById(existing.id).catch(() => {})
    }

    const create = async (item: string, name: string) =>
      (
        await UserRepository.save({
          name,
          email: item,
          emailVerified: true,
          password: await hashPassword(password),
          createAt: dayjs(),
        })
      ).id

    userId = await create(email, 'multi-factor')
    lockUserId = await create(lockEmail, 'multi-factor-lock')
    adminUserId = await create(adminEmail, 'multi-factor-admin')

    const { data } = await login()
    accessToken = data!.access_token
  })

  afterAll(async () => {
    for (const id of [userId, lockUserId, adminUserId]) {
      if (id) {
        await UserMultiFactorRepository.removeByUserId(id).catch(() => {})
        await UserRepository.removeById(id).catch(() => {})
      }
    }
    await appHandle.app.stop()
    if (originalAdminEmail === undefined) {
      delete process.env['ADMIN_EMAIL']
    } else {
      process.env['ADMIN_EMAIL'] = originalAdminEmail
    }
  })

  test('默认未启用且没有任何验证方式', async () => {
    const { data } = await mfa().get({ headers: authHeaders() })
    expect(data).toEqual({
      enabled: false,
      totp: false,
      recoveryCode: false,
      recoveryCodeCount: 0,
    })
  })

  test('未添加验证方式时不能启用', async () => {
    const { status } = await mfa().patch({ enabled: true }, { headers: authHeaders() })
    expect(status).toBe(400)
  })

  test('只有恢复码时不能启用', async () => {
    const { data: generated } = await mfa()['recovery-code'].generate.post(
      {},
      { headers: authHeaders() },
    )
    expect(generated!.codes).toHaveLength(10)
    await mfa()['recovery-code'].confirm.post(
      { batchId: generated!.batchId },
      { headers: authHeaders() },
    )

    // 恢复码是一次性凭证，用尽后无法登录，因此不允许单独作为启用依据
    const { status, error } = await mfa().patch({ enabled: true }, { headers: authHeaders() })
    expect(status).toBe(400)
    expect((error?.value as { message?: string })?.message).toContain('身份验证器')

    // 已绑定恢复码，移除时需要用恢复码校验，并告知前端可用方式
    const { status: noVerifyStatus, error: noVerifyError } = await mfa()[
      'recovery-code'
    ].remove.post({}, { headers: authHeaders() })
    expect(noVerifyStatus).toBe(400)
    expect((noVerifyError?.value as { data?: { mfaTypes?: string[] } })?.data?.mfaTypes).toEqual([
      'recovery_code',
    ])

    const { data: removed } = await mfa()['recovery-code'].remove.post(
      mfaFields({ type: 'recovery_code', value: generated!.codes.join('\n') }),
      { headers: authHeaders() },
    )
    expect(removed).toEqual({ success: true })
  })

  test('添加身份验证器需校验动态码后才落库', async () => {
    const { data: setup, status } = await mfa().totp.setup.post({}, { headers: authHeaders() })
    expect(status).toBe(200)
    expect(setup!.uri).toStartWith('otpauth://totp/')
    expect(setup!.uri).toContain(setup!.secret)
    secret = setup!.secret

    const { status: wrongStatus } = await mfa().totp.confirm.post(
      { code: '000000' },
      { headers: authHeaders() },
    )
    expect(wrongStatus).toBe(400)
    const { data: notBound } = await mfa().get({ headers: authHeaders() })
    expect(notBound!.totp).toBe(false)

    const { status: confirmStatus } = await mfa().totp.confirm.post(
      { code: generateTotp(secret) },
      { headers: authHeaders() },
    )
    expect(confirmStatus).toBe(200)
    const { data: bound } = await mfa().get({ headers: authHeaders() })
    expect(bound!.totp).toBe(true)
  })

  test('启用无需校验，启用后密码登录需要多因素验证码', async () => {
    const { status: toggleStatus } = await mfa().patch(
      { enabled: true },
      { headers: authHeaders() },
    )
    expect(toggleStatus).toBe(200)

    const { status, error } = await login(undefined, deviceB)
    // 400 而非 401：避免与 access_token 失效共用同一条刷新通道
    expect(status).toBe(400)
    // 前端依赖该错误码弹出多因素校验，并从 data.mfaTypes 中只展示已绑定的方式
    const errorBody = error?.value as { code?: string; data?: { mfaTypes?: string[] } }
    expect(errorBody?.code).toBe('SYSTEM.MULTI_FACTOR_REQUIRED')
    expect(errorBody?.data?.mfaTypes).toEqual(['totp'])

    const { status: wrongStatus } = await login({ type: 'totp', value: '000000' }, deviceB)
    expect(wrongStatus).toBe(400)
    // 登录日志的失败原因应与实际错误一致
    expect(await latestLoginFailReason(userId)).toBe('SYSTEM.MULTI_FACTOR_CODE_INCORRECT')

    const { data, status: okStatus } = await login(totpVerify(), deviceB)
    expect(okStatus).toBe(200)
    expect(data!.access_token).toBeString()

    // 同一设备再次登录仍需验证
    const { status: againStatus } = await login(undefined, deviceB)
    expect(againStatus).toBe(400)
  })

  test('验证码登录同样需要多因素验证', async () => {
    await resetUsedCounter()
    const code = '246810'
    const headers = { 'user-agent': deviceB }
    const codeKey = `${EmailService.KEY_PREFIX}${email}`
    await cache.set(codeKey, code, 60)

    const { status, error } = await api.system.oauth.token.post(
      { grant_type: 'email_code', email, code },
      { headers },
    )
    expect(status).toBe(400)
    expect((error?.value as { code?: string })?.code).toBe('SYSTEM.MULTI_FACTOR_REQUIRED')
    // 已绑定的验证方式随错误一并返回，前端无需再请求状态接口
    expect((error?.value as { data?: { mfaTypes?: string[] } })?.data?.mfaTypes).toEqual(['totp'])
    // 需要多因素验证时验证码不被消费，用户完成验证后可继续重试
    expect(await cache.get(codeKey)).toBe(code)

    const { data, status: okStatus } = await api.system.oauth.token.post(
      {
        grant_type: 'email_code',
        email,
        code,
        mfaType: 'totp',
        mfaValue: generateTotp(secret),
      },
      { headers },
    )
    expect(okStatus).toBe(200)
    expect(data!.access_token).toBeString()
    expect(await cache.get(codeKey)).toBeUndefined()
  })

  test('恢复码确认保存后才落库，且只能使用一次', async () => {
    await resetUsedCounter()
    const { data: generated } = await mfa()['recovery-code'].generate.post(
      mfaFields(totpVerify()),
      { headers: authHeaders() },
    )
    recoveryCodes = generated!.codes
    expect(recoveryCodes).toHaveLength(10)

    // 未确认保存前不落库
    const { data: beforeConfirm } = await mfa().get({ headers: authHeaders() })
    expect(beforeConfirm!.recoveryCode).toBe(false)

    await mfa()['recovery-code'].confirm.post(
      { batchId: generated!.batchId },
      { headers: authHeaders() },
    )
    const { data: afterConfirm } = await mfa().get({ headers: authHeaders() })
    expect(afterConfirm!.recoveryCode).toBe(true)
    expect(afterConfirm!.recoveryCodeCount).toBe(10)

    // 允许带空格、换行的完整恢复码文件，已使用的自动跳过
    const { status } = await login(
      { type: 'recovery_code', value: `\n  ${recoveryCodes.join('\n  ')}  \n` },
      'pika-device-c',
    )
    expect(status).toBe(200)
    expect((await mfa().get({ headers: authHeaders() })).data!.recoveryCodeCount).toBe(9)

    // 再次粘贴整份文件，自动跳过已使用的第一个
    const { status: wholeFileStatus } = await login(
      { type: 'recovery_code', value: recoveryCodes.join('\n') },
      'pika-device-d',
    )
    expect(wholeFileStatus).toBe(200)

    // 用空格分隔同样可以，再次自动跳过已使用的
    const { status: spaceStatus } = await login(
      { type: 'recovery_code', value: recoveryCodes.join('   ') },
      'pika-device-e',
    )
    expect(spaceStatus).toBe(200)

    // 多出任何不是恢复码的片段都不通过（不能被过滤掉）
    const { status: junkStatus } = await login(
      { type: 'recovery_code', value: [...recoveryCodes, 'xxx', 'yyy'].join('\n') },
      'pika-device-f',
    )
    expect(junkStatus).toBe(400)

    // 恢复码必须正好 10 个，多出第 11 个不通过
    const { status: extraStatus } = await login(
      { type: 'recovery_code', value: [...recoveryCodes, 'ABCDE-FGHIJ'].join('\n') },
      'pika-device-f',
    )
    expect(extraStatus).toBe(400)

    // 顺序必须与生成时一致，打乱后不再通过
    const { status: shuffledStatus } = await login(
      { type: 'recovery_code', value: [...recoveryCodes].reverse().join('\n') },
      'pika-device-e',
    )
    expect(shuffledStatus).toBe(400)

    // 只输入部分恢复码（哪怕包含未使用的）也不通过
    const { status: partialStatus } = await login(
      { type: 'recovery_code', value: recoveryCodes.slice(2).join('\n') },
      'pika-device-e',
    )
    expect(partialStatus).toBe(400)

    const { data: statusData } = await mfa().get({ headers: authHeaders() })
    expect(statusData!.recoveryCodeCount).toBe(7)

    // 前面的故意失败会计入失败次数，这里清理避免影响后续用例
    await clearFailureLogs()
  })

  test('同一动态码不能重复使用', async () => {
    await resetUsedCounter()
    const code = generateTotp(secret)
    const { status } = await login({ type: 'totp', value: code }, deviceB)
    expect(status).toBe(200)

    // 同一个时间步长的验证码已使用过，再次提交视为重放
    const { status: replayStatus, error } = await login({ type: 'totp', value: code }, deviceB)
    expect(replayStatus).toBe(400)
    expect((error?.value as { code?: string })?.code).toBe('SYSTEM.MULTI_FACTOR_CODE_USED')
    expect(await latestLoginFailReason(userId)).toBe('SYSTEM.MULTI_FACTOR_CODE_USED')
  })

  test('停用需要校验，停用后保留验证方式', async () => {
    await resetUsedCounter()
    const { status: wrongStatus } = await mfa().patch(
      { enabled: false, ...mfaFields({ type: 'totp', value: '000000' }) },
      { headers: authHeaders() },
    )
    expect(wrongStatus).toBe(400)

    const { data: disabled } = await mfa().patch(
      { enabled: false, ...mfaFields(totpVerify()) },
      { headers: authHeaders() },
    )
    expect(disabled).toEqual({ enabled: false })

    const { data: status } = await mfa().get({ headers: authHeaders() })
    expect(status).toMatchObject({ enabled: false, totp: true, recoveryCode: true })

    // 停用后登录不再要求多因素验证
    const { status: loginStatus } = await login(undefined, 'pika-device-e')
    expect(loginStatus).toBe(200)
  })

  test('停用登录两步验证后，敏感操作仍需校验', async () => {
    await resetUsedCounter()

    // 移除身份验证器必须有校验，与登录两步验证开关无关
    const { status: noVerifyStatus } = await mfa().totp.remove.post({}, { headers: authHeaders() })
    expect(noVerifyStatus).toBe(400)

    const { status: wrongStatus } = await mfa().totp.remove.post(
      mfaFields({ type: 'totp', value: '000000' }),
      { headers: authHeaders() },
    )
    expect(wrongStatus).toBe(400)

    await resetUsedCounter()
    const { data: removed } = await mfa().totp.remove.post(mfaFields(totpVerify()), {
      headers: authHeaders(),
    })
    expect(removed).toEqual({ success: true })
    const { data: afterRemove } = await mfa().get({ headers: authHeaders() })
    expect(afterRemove).toMatchObject({ enabled: false, totp: false, recoveryCode: true })

    // 此时只剩恢复码，移除恢复码同样需要校验
    const { status: codesNoVerifyStatus } = await mfa()['recovery-code'].remove.post(
      {},
      { headers: authHeaders() },
    )
    expect(codesNoVerifyStatus).toBe(400)
    // 每次都需粘贴完整文件（顺序一致）才能通过
    const { data: codesRemoved } = await mfa()['recovery-code'].remove.post(
      mfaFields({ type: 'recovery_code', value: recoveryCodes.join('\n') }),
      { headers: authHeaders() },
    )
    expect(codesRemoved).toEqual({ success: true })

    // 已无任何验证方式，重新添加身份验证器无需校验
    secret = await bindTotp(accessToken)
    const { data: afterAdd } = await mfa().get({ headers: authHeaders() })
    expect(afterAdd).toMatchObject({ enabled: false, totp: true, recoveryCode: false })

    // 已绑定身份验证器，生成恢复码需要校验
    const { status: generateNoVerifyStatus } = await mfa()['recovery-code'].generate.post(
      {},
      { headers: authHeaders() },
    )
    expect(generateNoVerifyStatus).toBe(400)

    await resetUsedCounter()
    const { data: generated } = await mfa()['recovery-code'].generate.post(
      mfaFields(totpVerify()),
      { headers: authHeaders() },
    )
    expect(generated!.codes).toHaveLength(10)
  })

  test('移除身份验证器后自动停用', async () => {
    await resetUsedCounter()
    // 准备：已有身份验证器，再补充恢复码后启用
    const { data: generated } = await mfa()['recovery-code'].generate.post(
      mfaFields(totpVerify()),
      { headers: authHeaders() },
    )
    expect(generated!.codes).toHaveLength(10)
    await mfa()['recovery-code'].confirm.post(
      { batchId: generated!.batchId },
      { headers: authHeaders() },
    )
    await mfa().patch({ enabled: true }, { headers: authHeaders() })

    // 已启用时移除身份验证器需要校验
    await resetUsedCounter()
    const { data } = await mfa().totp.remove.post(mfaFields(totpVerify()), {
      headers: authHeaders(),
    })
    expect(data).toEqual({ success: true })

    // 恢复码全部未使用也不再单独维持启用，避免用尽后账号无法登录
    const { data: status } = await mfa().get({ headers: authHeaders() })
    expect(status).toEqual({
      enabled: false,
      totp: false,
      recoveryCode: true,
      recoveryCodeCount: 10,
    })

    // 自动停用后登录不再要求多因素验证
    const { status: loginStatus } = await login(undefined, 'pika-device-f')
    expect(loginStatus).toBe(200)

    // 此时只剩恢复码，移除需要校验
    const { data: codesRemoved } = await mfa()['recovery-code'].remove.post(
      mfaFields({ type: 'recovery_code', value: generated!.codes.join('\n') }),
      { headers: authHeaders() },
    )
    expect(codesRemoved).toEqual({ success: true })
    const { data: finalStatus } = await mfa().get({ headers: authHeaders() })
    expect(finalStatus).toEqual({
      enabled: false,
      totp: false,
      recoveryCode: false,
      recoveryCodeCount: 0,
    })
  })

  test('验证失败次数过多时拒绝继续验证', async () => {
    const { data: lockLogin } = await api.system.oauth.token.post(
      { grant_type: 'password', username: lockEmail, password },
      { headers: { 'user-agent': deviceA } },
    )
    const lockToken = lockLogin!.access_token
    const lockSecret = await bindTotp(lockToken)
    await mfa().patch({ enabled: true }, { headers: { Authorization: `Bearer ${lockToken}` } })

    // 前 5 次校验返回验证码错误，第 6 次触发失败次数限制
    for (let i = 0; i < 5; i++) {
      const { status } = await mfa().patch(
        { enabled: false, ...mfaFields({ type: 'totp', value: '000000' }) },
        { headers: { Authorization: `Bearer ${lockToken}` } },
      )
      expect(status).toBe(400)
    }
    const { status: limitedStatus } = await mfa().patch(
      { enabled: false, ...mfaFields({ type: 'totp', value: generateTotp(lockSecret) }) },
      { headers: { Authorization: `Bearer ${lockToken}` } },
    )
    expect(limitedStatus).toBe(429)

    // 登录入口被限流时，登录日志应记录「失败次数过多」而不是「验证码错误」
    const { status: loginLimitedStatus } = await api.system.oauth.token.post(
      {
        grant_type: 'password',
        username: lockEmail,
        password,
        mfaType: 'totp',
        mfaValue: generateTotp(lockSecret),
      },
      { headers: { 'user-agent': deviceB } },
    )
    expect(loginLimitedStatus).toBe(429)
    expect(await latestLoginFailReason(lockUserId)).toBe('SYSTEM.MULTI_FACTOR_TOO_MANY_FAILURES')
  })

  test('管理员可直接移除用户多因素验证', async () => {
    secret = await bindTotp(accessToken)
    await mfa().patch({ enabled: true }, { headers: authHeaders() })

    const { data: adminLogin } = await api.system.oauth.token.post(
      { grant_type: 'password', username: adminEmail, password },
      { headers: { 'user-agent': 'pika-test-admin' } },
    )
    const adminToken = adminLogin!.access_token

    const { data, status } = await api.system.admin
      .user({ id: userId })
      ['multi-factor'].delete(undefined, { headers: { Authorization: `Bearer ${adminToken}` } })
    expect(status).toBe(200)
    expect(data).toEqual({ success: true })

    const user = await UserRepository.findById(userId)
    expect(user!.multiFactorEnabled).toBe(false)
    const factors = await UserMultiFactorRepository.listByUserId(userId)
    expect(factors).toHaveLength(0)
  })

  test('重新生成恢复码后，旧批次的确认会被拒绝', async () => {
    secret = await bindTotp(accessToken)
    await resetUsedCounter()
    const { data: first } = await mfa()['recovery-code'].generate.post(mfaFields(totpVerify()), {
      headers: authHeaders(),
    })
    await resetUsedCounter()
    const { data: second } = await mfa()['recovery-code'].generate.post(mfaFields(totpVerify()), {
      headers: authHeaders(),
    })

    // 双标签页：旧页面拿着第一批的批次标识确认，此时缓存里已是第二批
    const { status: staleStatus } = await mfa()['recovery-code'].confirm.post(
      { batchId: first!.batchId },
      { headers: authHeaders() },
    )
    expect(staleStatus).toBe(400)

    // 最新批次可以正常落库
    const { data: confirmed } = await mfa()['recovery-code'].confirm.post(
      { batchId: second!.batchId },
      { headers: authHeaders() },
    )
    expect(confirmed).toEqual({ success: true })
  })

  test('恢复码全部用尽后自动解绑，不会留下无法验证的绑定', async () => {
    // 启用登录两步验证并确认一批全新的恢复码
    await mfa().patch({ enabled: true }, { headers: authHeaders() })
    await resetUsedCounter()
    const { data: generated } = await mfa()['recovery-code'].generate.post(
      mfaFields(totpVerify()),
      { headers: authHeaders() },
    )
    await mfa()['recovery-code'].confirm.post(
      { batchId: generated!.batchId },
      { headers: authHeaders() },
    )
    const codes = generated!.codes
    expect(codes).toHaveLength(10)

    // 逐个消费全部恢复码，每次都要粘贴完整列表
    for (let i = 0; i < codes.length; i++) {
      const { status } = await login({ type: 'recovery_code', value: codes.join('\n') }, deviceB)
      expect(status).toBe(200)
    }

    // 用尽即解绑：凭证行被删除，不再展示为可用方式
    const { data: usedUp } = await mfa().get({ headers: authHeaders() })
    expect(usedUp).toEqual({ enabled: true, totp: true, recoveryCode: false, recoveryCodeCount: 0 })
    expect(
      await UserMultiFactorRepository.findByUserIdAndType(userId, 'recovery_code'),
    ).toBeUndefined()

    // 开关仍为启用，登录只要求仍然可用的身份验证器，不再提示已用尽的恢复码
    const { status: noVerifyStatus, error: noVerifyLoginError } = await login(undefined, deviceB)
    expect(noVerifyStatus).toBe(400)
    expect(
      (noVerifyLoginError?.value as { data?: { mfaTypes?: string[] } })?.data?.mfaTypes,
    ).toEqual(['totp'])
    await resetUsedCounter()
    const { status: loginStatus } = await login(totpVerify(), deviceB)
    expect(loginStatus).toBe(200)

    // 敏感操作只要求仍然可用的身份验证器，不再被用尽的恢复码卡住
    const { error: noVerifyError } = await mfa().totp.remove.post({}, { headers: authHeaders() })
    expect((noVerifyError?.value as { data?: { mfaTypes?: string[] } })?.data?.mfaTypes).toEqual([
      'totp',
    ])
    await resetUsedCounter()
    const { data: removed } = await mfa().totp.remove.post(mfaFields(totpVerify()), {
      headers: authHeaders(),
    })
    expect(removed).toEqual({ success: true })
    const { data: afterRemove } = await mfa().get({ headers: authHeaders() })
    expect(afterRemove).toEqual({
      enabled: false,
      totp: false,
      recoveryCode: false,
      recoveryCodeCount: 0,
    })

    // 已无任何验证方式，登录不再需要第二因素，且可自助重新绑定
    const { status: plainStatus } = await login(undefined, deviceB)
    expect(plainStatus).toBe(200)
    secret = await bindTotp(accessToken)
  })

  test('同一批次重复确认不会把已消费的恢复码重置为未使用', async () => {
    // 启用并生成一批恢复码，确认前先记下缓存中的待确认批次
    await mfa().patch({ enabled: true }, { headers: authHeaders() })
    await resetUsedCounter()
    const { data: generated } = await mfa()['recovery-code'].generate.post(
      mfaFields(totpVerify()),
      { headers: authHeaders() },
    )
    const pendingKey = `multi_factor_recovery_pending:${userId}`
    const pending = await cache.get<{ batchId: string; items: { hash: string }[] }>(pendingKey)
    await mfa()['recovery-code'].confirm.post(
      { batchId: generated!.batchId },
      { headers: authHeaders() },
    )
    expect((await mfa().get({ headers: authHeaders() })).data!.recoveryCodeCount).toBe(10)

    // 消费一个恢复码
    const { status } = await login(
      { type: 'recovery_code', value: generated!.codes.join('\n') },
      deviceB,
    )
    expect(status).toBe(200)
    expect((await mfa().get({ headers: authHeaders() })).data!.recoveryCodeCount).toBe(9)

    // 模拟缓存未清除导致的重复确认：同一批次再次确认，已消费的码不能被复活
    await cache.set(pendingKey, pending!, 60)
    const { data: reconfirmed } = await mfa()['recovery-code'].confirm.post(
      { batchId: generated!.batchId },
      { headers: authHeaders() },
    )
    expect(reconfirmed).toEqual({ success: true })
    expect((await mfa().get({ headers: authHeaders() })).data!.recoveryCodeCount).toBe(9)

    // 再次使用恢复码时消费的是下一个未使用的码，而不是已消费的那个
    const { status: secondStatus } = await login(
      { type: 'recovery_code', value: generated!.codes.join('\n') },
      deviceB,
    )
    expect(secondStatus).toBe(200)
    expect((await mfa().get({ headers: authHeaders() })).data!.recoveryCodeCount).toBe(8)
  })
})
