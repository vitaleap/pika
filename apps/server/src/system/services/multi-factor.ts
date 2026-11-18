import dayjs from 'dayjs'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { cache } from '@/common/cache'
import { config } from '@/common/config'
import { useDb } from '@/common/db'
import { t } from '@/common/plugins/i18n'
import { decryptText, encryptText, sha256 } from '@/common/utils/crypto'
import {
  buildTotpUri,
  generateTotpSecret,
  randomBase32,
  verifyTotp,
  verifyTotpCounter,
} from '@/common/utils/totp'
import { UserRepository } from '@/system/repositories/user'
import { UserMultiFactorRepository } from '@/system/repositories/user-multi-factor'
import { user } from '@/system/schemas/user'
import { loginFailReasons, type LoginFailReason } from '@/system/schemas/user-login-log'
import {
  multiFactorTypes,
  userMultiFactor,
  type MultiFactorType,
  type RecoveryCodeItem,
} from '@/system/schemas/user-multi-factor'
import { HttpError } from '@pika/elysia-plugins'

/** 验证器 App 中展示的签发者名称 */
const ISSUER = 'Pika'
/** 待确认的 TOTP 密钥缓存前缀，确认前不落库 */
const SETUP_KEY_PREFIX = 'multi_factor_totp_setup:'
/** 待确认的恢复码缓存前缀，用户确认已保存后才落库 */
const RECOVERY_KEY_PREFIX = 'multi_factor_recovery_pending:'
/** 用户级状态锁前缀，用于串行化「确认绑定」与「重置」 */
const STATE_KEY_PREFIX = 'multi_factor_state:'
/** 用户级校验锁前缀，使「计数 → 校验 → 写日志」串行 */
const VERIFY_KEY_PREFIX = 'multi_factor_verify:'
/** 待确认缓存的有效期（秒） */
const SETUP_TTL = 10 * 60
/** 每次生成的恢复码数量 */
const RECOVERY_CODE_COUNT = 10
/** 时间窗口内允许的验证失败次数 */
const MAX_FAILURES = 5
/** 失败次数统计窗口，单位分钟 */
const FAILURE_WINDOW_MINUTES = 10

/** 校验失败原因，调用方（如登录日志）可据此记录精确的失败原因 */
type MultiFactorFailReason = 'invalid' | 'replayed' | 'locked'

/** 验证码校验结果：通过 / 验证码错误 / 验证码已被使用过（重放） */
type CodeCheckResult = 'ok' | 'invalid' | 'replayed'

/** 缓存中待确认的恢复码批次，确认时必须回传同一批次，避免双标签页保存的文件失效 */
type PendingRecoveryCodes = { batchId: string; items: RecoveryCodeItem[] }

/** 多因素校验失败，`reason` 用于区分验证码错误 / 已被使用 / 失败次数过多 */
export class MultiFactorVerifyError extends HttpError {
  constructor(
    message: string,
    status: number,
    readonly reason: MultiFactorFailReason,
  ) {
    super(message, status, { detail: reason })
    this.name = 'MultiFactorVerifyError'
  }
}

/** 多因素失败原因与登录失败日志原因的对应关系，登录入口据此记录日志 */
export const multiFactorFailReasons: Record<MultiFactorFailReason, LoginFailReason> = {
  invalid: loginFailReasons.multiFactorIncorrect,
  replayed: loginFailReasons.multiFactorCodeUsed,
  locked: loginFailReasons.multiFactorTooManyFailures,
}

/**
 * 多因素校验入参，服务内部统一通过 `{ type, value }` 传递。
 * - `totp`：6 位动态码
 * - `recovery_code`：恢复码
 */
export type MultiFactorVerify = { type: MultiFactorType; value: string }

/**
 * 所有需要第二因素的接口（含登录）统一的请求字段。
 * 前端拦截 `SYSTEM.MULTI_FACTOR_REQUIRED` 后，把校验结果写入这两个字段重试即可；
 * 该错误的 `data.mfaTypes` 会带回已绑定的验证方式。
 */
export const multiFactorFields = {
  mfaType: z.enum(multiFactorTypes).optional().describe('第二因素类型，已绑定验证方式时必填'),
  mfaValue: z.string().trim().max(500).optional().describe('验证码或恢复码，已绑定验证方式时必填'),
}

/** 把请求字段转换为内部校验入参，两个字段未同时提供时视为未传 */
export const toMultiFactorVerify = (body: {
  mfaType?: MultiFactorType
  mfaValue?: string
}): MultiFactorVerify | undefined =>
  body.mfaType && body.mfaValue ? { type: body.mfaType, value: body.mfaValue } : undefined

/** 恢复码入库前统一格式并取摘要 */
const hashRecoveryCode = (code: string): string => sha256(code.toUpperCase().replace(/[\s-]/g, ''))

export abstract class MultiFactorService {
  static StatusRespSchema = z.object({
    enabled: z.boolean().describe('是否启用登录两步验证'),
    totp: z.boolean().describe('是否已添加身份验证器'),
    recoveryCode: z.boolean().describe('是否已添加恢复码'),
    recoveryCodeCount: z.number().describe('剩余可用恢复码数量'),
  })

  /** 需要第二因素校验的接口统一入参（首次添加验证方式时无需传） */
  static MultiFactorBodySchema = z.object(multiFactorFields)

  static SetupTotpRespSchema = z.object({
    secret: z.string().describe('Base32 密钥，可手动输入到验证器 App'),
    uri: z.string().describe('otpauth URI，用于生成二维码'),
  })

  static ConfirmTotpBodySchema = z.object({
    code: z.string().trim().min(1, t('SYSTEM.MULTI_FACTOR_VALUE_REQUIRED')).max(10),
  })

  static ConfirmTotpRespSchema = z.object({ success: z.boolean() })

  static RemoveRespSchema = z.object({ success: z.boolean() })

  static ToggleBodySchema = z.object({
    enabled: z.boolean(),
    ...multiFactorFields,
  })

  static ToggleRespSchema = z.object({ enabled: z.boolean() })

  static GenerateRecoveryCodesRespSchema = z.object({
    batchId: z.string().describe('本次生成批次标识，确认时需原样回传'),
    codes: z.array(z.string()).describe('恢复码，仅在生成时展示一次'),
  })

  static ConfirmRecoveryCodesBodySchema = z.object({
    batchId: z.string().min(1, t('SYSTEM.MULTI_FACTOR_VALUE_REQUIRED')),
  })

  static ConfirmRecoveryCodesRespSchema = z.object({ success: z.boolean() })

  private static getOrThrow = async (userId: string) => {
    const user = await UserRepository.findById(userId)
    if (!user) {
      throw new HttpError(t('SYSTEM.USER_NOT_FOUND'), 404)
    }
    return user
  }

  /** 解密已存储的 TOTP 密钥，密钥被轮换或数据损坏时提示重新添加 */
  private static decryptSecret = (secret: string): string => {
    try {
      return decryptText(secret, config.multiFactor.secret)
    } catch {
      throw new HttpError(t('SYSTEM.MULTI_FACTOR_SECRET_INVALID'), 400)
    }
  }

  /**
   * 当前是否有可用于校验的验证方式，类型按 `multiFactorTypes` 定义顺序返回，
   * 使前端默认选中项保持稳定。恢复码用尽后不再计入，避免留下「已绑定但无法验证」的死锁。
   */
  static hasMultiFactor = async (
    userId: string,
  ): Promise<{ hasMultiFactor: boolean; multiFactorTypes: MultiFactorType[] }> => {
    const factors = await UserMultiFactorRepository.listByUserId(userId)
    const usable = factors.filter((item) => {
      // 身份验证器可重复使用；恢复码是一次性凭证，必须还有未使用的记录
      if (item.type === 'totp') {
        return true
      }
      return (item.codes ?? []).some((code) => !code.usedAt)
    })
    const usableTypes = new Set(usable.map((item) => item.type))
    return {
      hasMultiFactor: usable.length > 0,
      multiFactorTypes: multiFactorTypes.filter((type) => usableTypes.has(type)),
    }
  }

  /**
   * 构造「需要多因素验证」错误，并把可用验证方式放在 `data.mfaTypes` 中，
   * 前端弹窗据此只渲染用户实际可用的方式。
   */
  static requiredError = async (userId: string): Promise<HttpError> => {
    const { multiFactorTypes } = await MultiFactorService.hasMultiFactor(userId)
    return new HttpError(t('SYSTEM.MULTI_FACTOR_REQUIRED'), 400, {
      data: { mfaTypes: multiFactorTypes },
    })
  }

  static getStatus = async (
    userId: string,
  ): Promise<z.infer<typeof MultiFactorService.StatusRespSchema>> => {
    const user = await MultiFactorService.getOrThrow(userId)
    const factors = await UserMultiFactorRepository.listByUserId(userId)
    const recoveryCodes = factors.find((item) => item.type === 'recovery_code')?.codes ?? []
    // 恢复码用尽后不再展示为可用方式，与校验入口保持一致
    const usableRecoveryCodes = recoveryCodes.filter((item) => !item.usedAt)
    return {
      enabled: user.multiFactorEnabled,
      totp: factors.some((item) => item.type === 'totp'),
      recoveryCode: usableRecoveryCodes.length > 0,
      recoveryCodeCount: usableRecoveryCodes.length,
    }
  }

  /** 校验验证码，恢复码校验成功即被消费；返回 `undefined` 表示通过 */
  private static checkCode = async (
    userId: string,
    verify: MultiFactorVerify,
  ): Promise<CodeCheckResult> => {
    const factor = await UserMultiFactorRepository.findByUserIdAndType(userId, verify.type)
    if (!factor) {
      return 'invalid'
    }
    if (verify.type === 'totp') {
      if (!factor.secret) {
        return 'invalid'
      }
      // 允许输入中包含空格，如 `167 626`
      const counter = verifyTotpCounter(
        MultiFactorService.decryptSecret(factor.secret),
        verify.value.replace(/\D/g, ''),
      )
      if (counter === undefined) {
        return 'invalid'
      }
      // 同一时间步长的验证码只能用一次，避免验证码在有效窗口内被重放
      // 计数器写入绑定到本次校验的凭证行，凭证被重置重建时不会误写到新行
      return (await UserMultiFactorRepository.useTotpCounter(factor.id, counter))
        ? 'ok'
        : 'replayed'
    }
    return (await MultiFactorService.consumeRecoveryCode(userId, verify.value)) ? 'ok' : 'invalid'
  }

  /**
   * 消费一个未使用的恢复码：输入必须是生成时展示的完整列表（按空格、换行拆分），
   * 数量与顺序都要一致，已使用的由服务端自行跳过。
   * 用事务 + 行锁读取并写回，避免并发校验时同一个恢复码被使用两次。
   */
  private static consumeRecoveryCode = async (userId: string, input: string): Promise<boolean> => {
    const inputHashes = input.trim().split(/\s+/).map(hashRecoveryCode)
    // 第一步：必须输入完整的 10 个恢复码
    if (inputHashes.length !== RECOVERY_CODE_COUNT) {
      return false
    }
    return useDb().transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(userMultiFactor)
        .where(and(eq(userMultiFactor.userId, userId), eq(userMultiFactor.type, 'recovery_code')))
        .for('update')
      const codes = row?.codes ?? []
      // 第二步：必须还有未使用的恢复码
      const index = codes.findIndex((item) => !item.usedAt)
      if (!row || index === -1) {
        return false
      }
      // 第三步：数量与顺序都必须与生成时一致
      const sameCodes =
        inputHashes.length === codes.length &&
        inputHashes.every((hash, i) => hash === codes[i]!.hash)
      if (!sameCodes) {
        return false
      }
      const usedAt = dayjs().toISOString()
      const next = codes.map((item, i) => (i === index ? { ...item, usedAt } : item))
      if (next.some((item) => !item.usedAt)) {
        await tx.update(userMultiFactor).set({ codes: next }).where(eq(userMultiFactor.id, row.id))
        return true
      }
      // 最后一个恢复码被消费后该方式即视为解绑：删除凭证行，避免留下「已绑定但无法验证」的死锁
      await tx.delete(userMultiFactor).where(eq(userMultiFactor.id, row.id))
      const [remaining] = await tx
        .select({ id: userMultiFactor.id })
        .from(userMultiFactor)
        .where(eq(userMultiFactor.userId, userId))
        .limit(1)
      // 已无任何验证方式时同步关闭开关，避免残留不一致的启用状态
      if (!remaining) {
        await tx.update(user).set({ multiFactorEnabled: false }).where(eq(user.id, userId))
      }
      return true
    })
  }

  /** 高危操作统一入口：校验并记录日志 */
  static assertVerified = async (params: {
    userId: string
    verify: MultiFactorVerify
    ip: string
    userAgent: string
  }): Promise<void> => {
    const { userId, verify, ip, userAgent } = params
    // 计数、校验、写日志必须在同一把用户级锁内，否则并发请求能同时读到未超限的计数
    await cache.lock(`${VERIFY_KEY_PREFIX}${userId}`, async () => {
      // 失败次数过多时拒绝校验，避免暴力破解验证码
      const failures = await UserMultiFactorRepository.countRecentFailures(
        userId,
        FAILURE_WINDOW_MINUTES,
      )
      if (failures >= MAX_FAILURES) {
        throw new MultiFactorVerifyError(t('SYSTEM.MULTI_FACTOR_TOO_MANY_FAILURES'), 429, 'locked')
      }
      const result = await MultiFactorService.checkCode(userId, verify)
      await UserMultiFactorRepository.saveLog({
        userId,
        type: verify.type,
        ip,
        userAgent,
        success: result === 'ok',
        failReason: result === 'ok' ? undefined : multiFactorFailReasons[result],
      })
      if (result === 'replayed') {
        throw new MultiFactorVerifyError(t('SYSTEM.MULTI_FACTOR_CODE_USED'), 400, result)
      }
      if (result === 'invalid') {
        throw new MultiFactorVerifyError(t('SYSTEM.MULTI_FACTOR_CODE_INCORRECT'), 400, result)
      }
    })
  }

  /** 在同一事务内删除凭证并关闭两步验证，避免两次写入之间留下不一致状态 */
  private static removeFactorInTx = async (
    userId: string,
    type?: MultiFactorType,
  ): Promise<void> => {
    const where = type
      ? and(eq(userMultiFactor.userId, userId), eq(userMultiFactor.type, type))
      : eq(userMultiFactor.userId, userId)
    await useDb().transaction(async (tx) => {
      await tx.delete(userMultiFactor).where(where)
      await tx.update(user).set({ multiFactorEnabled: false }).where(eq(user.id, userId))
    })
  }

  /**
   * 高危操作（添加/移除验证方式、停用登录两步验证等）的校验入口：
   * 只要已绑定任意验证方式就必须校验，与 `user.multiFactorEnabled` 无关，
   * 该开关只决定登录时是否要求第二因素，不能用来绕过敏感操作的保护。
   */
  static assertVerifiedIfBound = async (params: {
    userId: string
    verify?: MultiFactorVerify
    ip: string
    userAgent: string
  }): Promise<void> => {
    const { hasMultiFactor } = await MultiFactorService.hasMultiFactor(params.userId)
    if (!hasMultiFactor) {
      return
    }
    if (!params.verify) {
      throw await MultiFactorService.requiredError(params.userId)
    }
    await MultiFactorService.assertVerified({
      userId: params.userId,
      verify: params.verify,
      ip: params.ip,
      userAgent: params.userAgent,
    })
  }

  static setEnabled = async (
    userId: string,
    body: z.infer<typeof MultiFactorService.ToggleBodySchema>,
    ip: string,
    userAgent: string,
  ): Promise<z.infer<typeof MultiFactorService.ToggleRespSchema>> => {
    const user = await MultiFactorService.getOrThrow(userId)
    // 恢复码是一次性凭证，启用后必须存在可重复使用的身份验证器，否则用尽后无法登录
    if (body.enabled && !(await UserMultiFactorRepository.findByUserIdAndType(userId, 'totp'))) {
      throw new HttpError(t('SYSTEM.MULTI_FACTOR_TOTP_REQUIRED'), 400)
    }
    // 停用会让账号失去额外保护，需要校验；启用无需校验
    if (user.multiFactorEnabled && !body.enabled) {
      const verify = toMultiFactorVerify(body)
      if (!verify) {
        throw await MultiFactorService.requiredError(userId)
      }
      await MultiFactorService.assertVerified({ userId, verify, ip, userAgent })
    }
    await UserRepository.updateById(userId, { multiFactorEnabled: body.enabled })
    return { enabled: body.enabled }
  }

  /** 生成 TOTP 密钥并缓存，等待用户扫码后输入验证码确认 */
  static setupTotp = async (
    userId: string,
    body: z.infer<typeof MultiFactorService.MultiFactorBodySchema>,
    ip: string,
    userAgent: string,
  ): Promise<z.infer<typeof MultiFactorService.SetupTotpRespSchema>> => {
    const user = await MultiFactorService.getOrThrow(userId)
    if (await UserMultiFactorRepository.findByUserIdAndType(userId, 'totp')) {
      throw new HttpError(t('SYSTEM.MULTI_FACTOR_TOTP_EXISTS'), 400)
    }
    await MultiFactorService.assertVerifiedIfBound({
      userId,
      verify: toMultiFactorVerify(body),
      ip,
      userAgent,
    })
    const secret = generateTotpSecret()
    await cache.set(`${SETUP_KEY_PREFIX}${userId}`, secret, SETUP_TTL)
    return {
      secret,
      uri: buildTotpUri({
        secret,
        issuer: ISSUER,
        account: user.email ?? user.phoneNumber ?? user.name,
      }),
    }
  }

  /** 校验动态码后落库身份验证器 */
  static confirmTotp = async (
    userId: string,
    body: z.infer<typeof MultiFactorService.ConfirmTotpBodySchema>,
  ): Promise<z.infer<typeof MultiFactorService.ConfirmTotpRespSchema>> => {
    await MultiFactorService.getOrThrow(userId)
    // 与 clear 串行：避免管理员重置完成后，这里又把刚被移除的验证器写回去
    return cache.lock(`${STATE_KEY_PREFIX}${userId}`, async () => {
      const pending = await cache.get<string>(`${SETUP_KEY_PREFIX}${userId}`)
      if (!pending) {
        throw new HttpError(t('SYSTEM.MULTI_FACTOR_SETUP_EXPIRED'), 400)
      }
      if (!verifyTotp(pending, body.code.replace(/\D/g, ''))) {
        throw new HttpError(t('SYSTEM.MULTI_FACTOR_CODE_INCORRECT'), 400)
      }
      await UserMultiFactorRepository.save(userId, 'totp', {
        secret: encryptText(pending, config.multiFactor.secret),
      })
      await cache.del(`${SETUP_KEY_PREFIX}${userId}`)
      return { success: true }
    })
  }

  static removeTotp = async (
    userId: string,
    body: z.infer<typeof MultiFactorService.MultiFactorBodySchema>,
    ip: string,
    userAgent: string,
  ): Promise<z.infer<typeof MultiFactorService.RemoveRespSchema>> => {
    // 与 confirmTotp / clear 共用状态锁：三者都改「验证方式 + 开关」，串行避免互相覆盖
    return cache.lock(`${STATE_KEY_PREFIX}${userId}`, async () => {
      if (!(await UserMultiFactorRepository.findByUserIdAndType(userId, 'totp'))) {
        throw new HttpError(t('SYSTEM.MULTI_FACTOR_NOT_BOUND'), 400)
      }
      // 移除身份验证器是敏感操作，必须校验，与登录两步验证开关无关
      await MultiFactorService.assertVerifiedIfBound({
        userId,
        verify: toMultiFactorVerify(body),
        ip,
        userAgent,
      })
      // 身份验证器是唯一可重复使用的验证方式，移除后必须停用，避免账号再无可用凭证
      await MultiFactorService.removeFactorInTx(userId, 'totp')
      return { success: true }
    })
  }

  /**
   * 生成一批恢复码并缓存，用户确认已保存后才落库；重新生成会作废旧恢复码。
   */
  static generateRecoveryCodes = async (
    userId: string,
    body: z.infer<typeof MultiFactorService.MultiFactorBodySchema>,
    ip: string,
    userAgent: string,
  ): Promise<z.infer<typeof MultiFactorService.GenerateRecoveryCodesRespSchema>> => {
    await MultiFactorService.getOrThrow(userId)
    await MultiFactorService.assertVerifiedIfBound({
      userId,
      verify: toMultiFactorVerify(body),
      ip,
      userAgent,
    })
    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => {
      const raw = randomBase32(10)
      return `${raw.slice(0, 5)}-${raw.slice(5)}`
    })
    const items: RecoveryCodeItem[] = codes.map((code) => ({ hash: hashRecoveryCode(code) }))
    // 批次标识随恢复码一起返回，确认时校验，避免多标签页下「看到的」与「落库的」不是同一批
    const batchId = randomBase32(8)
    await cache.set<PendingRecoveryCodes>(
      `${RECOVERY_KEY_PREFIX}${userId}`,
      { batchId, items },
      SETUP_TTL,
    )
    return { batchId, codes }
  }

  /** 用户确认已保存恢复码后才真正落库 */
  static confirmRecoveryCodes = async (
    userId: string,
    body: z.infer<typeof MultiFactorService.ConfirmRecoveryCodesBodySchema>,
  ): Promise<z.infer<typeof MultiFactorService.ConfirmRecoveryCodesRespSchema>> => {
    await MultiFactorService.getOrThrow(userId)
    // 与 confirmTotp / clear 共用状态锁：避免管理员重置后这里又把恢复码写回去
    return cache.lock(`${STATE_KEY_PREFIX}${userId}`, async () => {
      const pending = await cache.get<PendingRecoveryCodes>(`${RECOVERY_KEY_PREFIX}${userId}`)
      if (!pending) {
        throw new HttpError(t('SYSTEM.MULTI_FACTOR_SETUP_EXPIRED'), 400)
      }
      if (pending.batchId !== body.batchId) {
        throw new HttpError(t('SYSTEM.MULTI_FACTOR_RECOVERY_CODE_SUPERSEDED'), 400)
      }
      // 同一批次重复确认时保留已消费记录，避免把已用过的恢复码重置为未使用
      const existing =
        (await UserMultiFactorRepository.findByUserIdAndType(userId, 'recovery_code'))?.codes ?? []
      const items = pending.items.map((item) => {
        const usedAt = existing.find((code) => code.hash === item.hash)?.usedAt
        return usedAt ? { ...item, usedAt } : item
      })
      await UserMultiFactorRepository.save(userId, 'recovery_code', { codes: items })
      await cache.del(`${RECOVERY_KEY_PREFIX}${userId}`)
      return { success: true }
    })
  }

  static removeRecoveryCodes = async (
    userId: string,
    body: z.infer<typeof MultiFactorService.MultiFactorBodySchema>,
    ip: string,
    userAgent: string,
  ): Promise<z.infer<typeof MultiFactorService.RemoveRespSchema>> => {
    if (!(await UserMultiFactorRepository.findByUserIdAndType(userId, 'recovery_code'))) {
      throw new HttpError(t('SYSTEM.MULTI_FACTOR_NOT_BOUND'), 400)
    }
    await MultiFactorService.assertVerifiedIfBound({
      userId,
      verify: toMultiFactorVerify(body),
      ip,
      userAgent,
    })
    await UserMultiFactorRepository.remove(userId, 'recovery_code')
    return { success: true }
  }

  /** 清除用户的多因素数据，管理员重置时无需校验 */
  static clear = async (userId: string): Promise<void> => {
    // 与 confirmTotp 串行，避免重置后用户正在确认的验证器又被写回
    await cache.lock(`${STATE_KEY_PREFIX}${userId}`, async () => {
      await MultiFactorService.removeFactorInTx(userId)
      await cache.del(`${SETUP_KEY_PREFIX}${userId}`)
      await cache.del(`${RECOVERY_KEY_PREFIX}${userId}`)
    })
  }
}
