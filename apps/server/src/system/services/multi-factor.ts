import { z } from 'zod'
import { cache } from '@/common/cache'
import { config } from '@/common/config'
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
import { loginFailReasons, type LoginFailReason } from '@/system/schemas/user-login-log'
import {
  multiFactorTypes,
  type MultiFactorType,
  type RecoveryCodeItem,
} from '@/system/schemas/user-multi-factor'
import { HttpError, type HttpErrorOptions } from '@pika/elysia-plugins'

/** 待确认的 TOTP 密钥缓存前缀，确认前不落库 */
const SETUP_TOTP_KEY_PREFIX = 'multi_factor_totp_setup:'
/** 待确认的恢复码缓存前缀，用户确认已保存后才落库 */
const SETUP_RECOVERY_KEY_PREFIX = 'multi_factor_recovery_setup:'
/** 用户级状态锁前缀，用于串行化「确认绑定」与「重置」 */
const STATE_KEY_PREFIX = 'multi_factor_state:'
/** 用户级校验锁前缀，使「计数 → 校验 → 写日志」串行 */
const VERIFY_KEY_PREFIX = 'multi_factor_verify:'
/** 待确认缓存的有效期（秒） */
const SETUP_TTL = '5m'
/** 每次生成的恢复码数量 */
const RECOVERY_CODE_COUNT = 10
/** 时间窗口内允许的验证失败次数 */
const MAX_FAILURES = 5
/** 失败次数统计窗口，单位分钟 */
const FAILURE_WINDOW_MINUTES = 5

/** 校验失败原因，调用方（如登录日志）可据此记录精确的失败原因 */
type MultiFactorFailReason = 'invalid' | 'replayed' | 'locked'

/** 多因素异常原因：`required` 是「缺少第二因素」的中间态，其余为校验失败 */
type MultiFactorErrorReason = MultiFactorFailReason | 'required'

/** 验证码校验结果：通过 / 验证码错误 / 验证码已被使用过（重放） */
type CodeCheckResult = 'ok' | 'invalid' | 'replayed'

/** 缓存中待确认的恢复码批次，确认时必须回传同一批次，避免双标签页保存的文件失效 */
type PendingRecoveryCodes = { batchId: string; items: RecoveryCodeItem[] }

/** 多因素失败原因与登录失败日志原因的对应关系，登录入口据此记录日志 */
const multiFactorFailReasons: Record<MultiFactorFailReason, LoginFailReason> = {
  invalid: loginFailReasons.multiFactorIncorrect,
  replayed: loginFailReasons.multiFactorCodeUsed,
  locked: loginFailReasons.multiFactorTooManyFailures,
}

/**
 * 多因素业务异常，统一承载「需要补充第二因素」与「校验失败」：
 * - `required`：本次请求未携带第二因素，属于中间态，调用方不应据此写失败日志或计数
 * - `invalid` / `replayed` / `locked`：校验失败，`reasonMsg` 是对应的登录失败原因
 */
export class MultiFactorError extends HttpError {
  constructor(
    message: string,
    status: number,
    readonly reason: MultiFactorErrorReason,
    args?: HttpErrorOptions,
  ) {
    super(message, status, { detail: reason, ...args })
    this.name = 'MultiFactorError'
  }

  /** 校验失败对应的登录失败原因；中间态（`required`）为 `undefined`，不记录失败日志 */
  get reasonMsg(): LoginFailReason | undefined {
    return this.reason === 'required' ? undefined : multiFactorFailReasons[this.reason]
  }
}

/**
 * 多因素校验入参，服务内部统一通过 `{ mfaType, mfaValue }` 传递。
 * - `totp`：6 位动态码
 * - `recovery_code`：恢复码
 */
export type MultiFactorVerify = { mfaType: MultiFactorType; mfaValue: string }

/**
 * 所有需要第二因素的接口（含登录）统一的请求字段。
 * 前端拦截 `SYSTEM.MULTI_FACTOR_REQUIRED` 后，把校验结果写入这两个字段重试即可；
 * 该错误的 `data.mfaTypes` 会带回已绑定的验证方式。
 */
export const mfaSchema = z.object({
  mfaType: z.enum(multiFactorTypes).optional().describe('第二因素类型，已绑定验证方式时必填'),
  mfaValue: z.string().trim().max(500).optional().describe('验证码或恢复码，已绑定验证方式时必填'),
})

/** 恢复码入库前统一格式并取摘要 */
const hashRecoveryCode = (code: string): string => sha256(code.toUpperCase().replace(/[\s-]/g, ''))

export abstract class MultiFactorService {
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

  static StatusRespSchema = z.object({
    enabled: z.boolean().describe('是否启用登录两步验证'),
    totp: z.boolean().describe('是否已添加身份验证器'),
    recoveryCode: z.boolean().describe('是否已添加恢复码'),
    recoveryCodeCount: z.number().describe('剩余可用恢复码数量'),
  })

  static getStatus = async (
    userId: string,
  ): Promise<z.infer<typeof MultiFactorService.StatusRespSchema>> => {
    const user = await UserRepository.findByIdOrThrow(userId)
    const factors = await UserMultiFactorRepository.listByUserId(userId)
    const recoveryCodes = factors.find((item) => item.type === 'recovery_code')?.codes ?? []
    // 恢复码用尽后不再展示为可用方式，与校验入口保持一致
    const usableRecoveryCodes = recoveryCodes.filter((item) => !item.usedAt)
    return {
      enabled: user.loginMultiFactorEnabled,
      totp: factors.some((item) => item.type === 'totp'),
      recoveryCode: usableRecoveryCodes.length > 0,
      recoveryCodeCount: usableRecoveryCodes.length,
    }
  }

  /**
   * 消费一个未使用的恢复码：输入必须是生成时展示的完整列表（按空格、换行拆分），
   * 数量与顺序都要一致，已使用的由服务端自行跳过。
   */
  private static _consumeRecoveryCode = async (userId: string, input: string): Promise<boolean> => {
    const inputHashes = input.trim().split(/\s+/).map(hashRecoveryCode)
    if (inputHashes.length !== RECOVERY_CODE_COUNT) {
      return false
    }
    return UserMultiFactorRepository.consumeRecoveryCode(userId, inputHashes)
  }

  /** 校验动态码或恢复码，返回 `'ok'` 表示通过；恢复码校验成功即被消费 */
  private static _verifyCode = async (
    userId: string,
    verify: MultiFactorVerify,
  ): Promise<CodeCheckResult> => {
    const factor = await UserMultiFactorRepository.findByUserIdAndType(userId, verify.mfaType)
    if (!factor) {
      return 'invalid'
    }
    if (verify.mfaType === 'recovery_code') {
      return (await MultiFactorService._consumeRecoveryCode(userId, verify.mfaValue))
        ? 'ok'
        : 'invalid'
    }
    // when verify.mfaType === 'totp'
    if (!factor.secret) {
      return 'invalid'
    }
    /** 解密已存储的 TOTP 密钥，密钥被轮换或数据损坏时提示重新添加 */
    const decryptSecret = (secret: string): string => {
      try {
        return decryptText(secret, config.multiFactor.secret)
      } catch {
        throw new HttpError(t('SYSTEM.MULTI_FACTOR_SECRET_INVALID'), 400)
      }
    }
    // 允许输入中包含空格，如 `167 626`
    const counter = verifyTotpCounter(
      decryptSecret(factor.secret),
      verify.mfaValue.replace(/\D/g, ''),
    )
    if (counter === undefined) {
      return 'invalid'
    }
    // 同一时间步长的验证码只能用一次，避免验证码在有效窗口内被重放
    // 计数器写入绑定到本次校验的凭证行，凭证被重置重建时不会误写到新行
    return (await UserMultiFactorRepository.useTotpCounter(factor.id, counter)) ? 'ok' : 'replayed'
  }

  /**
   * 校验多因素，用于所有高危操作
   *  1. 判断是否存在多因素验证，不存在则直接返回
   *  2. 判断传入 mfa 数据，不规范则直接抛出特殊异常
   * 高危操作（添加/移除验证方式、停用登录两步验证等）的校验入口：
   * 只要已绑定任意验证方式就必须校验，与 `user.loginMultiFactorEnabled` 无关，
   * 该开关只决定登录时是否要求第二因素，不能用来绕过敏感操作的保护。
   */
  static verifyMultiFactorOrThrow = async (params: {
    userId: string
    mfa: Partial<MultiFactorVerify> | undefined
    ip: string
    userAgent: string
  }): Promise<void> => {
    const { userId, mfa, ip, userAgent } = params
    // 判断是否有多因素验证，若无直接返回，不需要校验
    const { hasMultiFactor, multiFactorTypes } = await MultiFactorService.hasMultiFactor(userId)
    if (!hasMultiFactor) {
      return
    }
    if (mfa?.mfaType === undefined || mfa?.mfaValue === undefined) {
      throw new MultiFactorError(t('SYSTEM.MULTI_FACTOR_REQUIRED'), 400, 'required', {
        data: { mfaTypes: multiFactorTypes },
      })
    }
    const verify = {
      mfaType: mfa.mfaType,
      mfaValue: mfa.mfaValue,
    }
    // 计数、校验、写日志必须在同一把用户级锁内，否则并发请求能同时读到未超限的计数
    await cache.lock(`${VERIFY_KEY_PREFIX}${userId}`, async () => {
      // 失败次数过多时拒绝校验，避免暴力破解验证码
      const failures = await UserMultiFactorRepository.countRecentFailures(
        userId,
        FAILURE_WINDOW_MINUTES,
      )
      if (failures >= MAX_FAILURES) {
        throw new MultiFactorError(t('SYSTEM.MULTI_FACTOR_TOO_MANY_FAILURES'), 429, 'locked')
      }
      const result = await MultiFactorService._verifyCode(userId, verify)
      await UserMultiFactorRepository.saveLog({
        userId,
        type: verify.mfaType,
        ip,
        userAgent,
        success: result === 'ok',
        failReason: result === 'ok' ? undefined : multiFactorFailReasons[result],
      })
      if (result === 'replayed') {
        throw new MultiFactorError(t('SYSTEM.MULTI_FACTOR_CODE_USED'), 400, result)
      }
      if (result === 'invalid') {
        throw new MultiFactorError(t('SYSTEM.MULTI_FACTOR_CODE_INCORRECT'), 400, result)
      }
    })
  }

  static SetLoginMultiFactorBodySchema = z
    .object({
      enabled: z.boolean(),
    })
    .extend(mfaSchema.shape)
  static SetLoginMultiFactorRespSchema = z.object({ enabled: z.boolean() })

  static setLoginMultiFactor = async (
    userId: string,
    body: z.infer<typeof MultiFactorService.SetLoginMultiFactorBodySchema>,
    ip: string,
    userAgent: string,
  ): Promise<z.infer<typeof MultiFactorService.SetLoginMultiFactorRespSchema>> => {
    await MultiFactorService.verifyMultiFactorOrThrow({ userId, mfa: body, ip, userAgent })
    await UserRepository.updateById(userId, { loginMultiFactorEnabled: body.enabled })
    return { enabled: body.enabled }
  }

  /** 生成 TOTP 密钥并缓存，等待用户扫码后输入验证码确认 */

  static SetupTotpRespSchema = z.object({
    secret: z.string().describe('Base32 密钥，可手动输入到验证器 App'),
    uri: z.string().describe('otpauth URI，用于生成二维码'),
  })
  static setupTotp = async (
    userId: string,
    body: z.infer<typeof MultiFactorService.MultiFactorBodySchema>,
    ip: string,
    userAgent: string,
  ): Promise<z.infer<typeof MultiFactorService.SetupTotpRespSchema>> => {
    const user = await UserRepository.findByIdOrThrow(userId)
    if (await UserMultiFactorRepository.findByUserIdAndType(userId, 'totp')) {
      throw new HttpError(t('SYSTEM.MULTI_FACTOR_TOTP_EXISTS'), 400)
    }
    await MultiFactorService.verifyMultiFactorOrThrow({
      userId,
      mfa: body,
      ip,
      userAgent,
    })
    const secret = generateTotpSecret()
    await cache.set(`${SETUP_TOTP_KEY_PREFIX}${userId}`, secret, SETUP_TTL)
    return {
      secret,
      uri: buildTotpUri({
        secret,
        issuer: config.jwt.issuer,
        account: user.email ?? user.phoneNumber ?? user.name,
      }),
    }
  }

  /** 校验动态码后落库身份验证器 */
  static ConfirmTotpBodySchema = z.object({
    code: z.string().trim().min(1, t('SYSTEM.MULTI_FACTOR_VALUE_REQUIRED')).max(10),
  })
  static ConfirmTotpRespSchema = z.object({ success: z.boolean() })
  static confirmTotp = async (
    userId: string,
    body: z.infer<typeof MultiFactorService.ConfirmTotpBodySchema>,
  ): Promise<z.infer<typeof MultiFactorService.ConfirmTotpRespSchema>> => {
    await UserRepository.findByIdOrThrow(userId)
    // 与 clear 串行：避免管理员重置完成后，这里又把刚被移除的验证器写回去
    return cache.lock(`${STATE_KEY_PREFIX}${userId}`, async () => {
      // 已绑定身份验证器时不允许再次确认，避免并发 setup 覆盖已生效的密钥
      if (await UserMultiFactorRepository.findByUserIdAndType(userId, 'totp')) {
        throw new HttpError(t('SYSTEM.MULTI_FACTOR_TOTP_EXISTS'), 400)
      }
      const pending = await cache.get<string>(`${SETUP_TOTP_KEY_PREFIX}${userId}`)
      if (!pending) {
        throw new HttpError(t('SYSTEM.MULTI_FACTOR_SETUP_EXPIRED'), 400)
      }
      if (!verifyTotp(pending, body.code.replace(/\D/g, ''))) {
        throw new HttpError(t('SYSTEM.MULTI_FACTOR_CODE_INCORRECT'), 400)
      }
      await UserMultiFactorRepository.save(userId, 'totp', {
        secret: encryptText(pending, config.multiFactor.secret),
      })
      await cache.del(`${SETUP_TOTP_KEY_PREFIX}${userId}`)
      return { success: true }
    })
  }

  static RemoveRespSchema = z.object({ success: z.boolean() })
  static removeTotp = async (
    userId: string,
    body: z.infer<typeof MultiFactorService.MultiFactorBodySchema>,
    ip: string,
    userAgent: string,
  ): Promise<z.infer<typeof MultiFactorService.RemoveRespSchema>> => {
    // 与 confirmTotp / clear 共用状态锁：三者都改「验证方式 + 开关」，串行避免互相覆盖
    return cache.lock(`${STATE_KEY_PREFIX}${userId}`, async () => {
      await MultiFactorService.verifyMultiFactorOrThrow({
        userId,
        mfa: body,
        ip,
        userAgent,
      })
      await UserMultiFactorRepository.removeByUserId(userId, 'totp')
      return { success: true }
    })
  }

  /**
   * 生成一批恢复码并缓存，用户确认已保存后才落库；重新生成会作废旧恢复码。
   */
  static GenerateRecoveryCodesRespSchema = z.object({
    batchId: z.string().describe('本次生成批次标识，确认时需原样回传'),
    codes: z.array(z.string()).describe('恢复码，仅在生成时展示一次'),
  })
  static generateRecoveryCodes = async (
    userId: string,
    body: z.infer<typeof MultiFactorService.MultiFactorBodySchema>,
    ip: string,
    userAgent: string,
  ): Promise<z.infer<typeof MultiFactorService.GenerateRecoveryCodesRespSchema>> => {
    await UserRepository.findByIdOrThrow(userId)
    await MultiFactorService.verifyMultiFactorOrThrow({
      userId,
      mfa: body,
      ip,
      userAgent,
    })
    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => {
      const raw = randomBase32(10)
      return `${raw.slice(0, 5)}-${raw.slice(5)}`
    })
    const items: RecoveryCodeItem[] = codes.map((code) => ({ hash: hashRecoveryCode(code) }))
    // 批次标识随恢复码一起返回，确认时校验，避免多账户下「看到的」与「落库的」不是同一批
    const batchId = randomBase32(8)
    await cache.set<PendingRecoveryCodes>(
      `${SETUP_RECOVERY_KEY_PREFIX}${userId}`,
      { batchId, items },
      SETUP_TTL,
    )
    return { batchId, codes }
  }

  /**
   * 用户确认已保存恢复码后才真正落库
   */
  static ConfirmRecoveryCodesBodySchema = z.object({
    batchId: z.string().min(1, t('SYSTEM.MULTI_FACTOR_VALUE_REQUIRED')),
  })
  static ConfirmRecoveryCodesRespSchema = z.object({ success: z.boolean() })
  static confirmRecoveryCodes = async (
    userId: string,
    body: z.infer<typeof MultiFactorService.ConfirmRecoveryCodesBodySchema>,
  ): Promise<z.infer<typeof MultiFactorService.ConfirmRecoveryCodesRespSchema>> => {
    await UserRepository.findByIdOrThrow(userId)
    // 与 confirmTotp / clear 共用状态锁：避免管理员重置后这里又把恢复码写回去
    return cache.lock(`${STATE_KEY_PREFIX}${userId}`, async () => {
      const pending = await cache.get<PendingRecoveryCodes>(`${SETUP_RECOVERY_KEY_PREFIX}${userId}`)
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
      await cache.del(`${SETUP_RECOVERY_KEY_PREFIX}${userId}`)
      return { success: true }
    })
  }

  static MultiFactorBodySchema = mfaSchema
  static removeRecoveryCodes = async (
    userId: string,
    body: z.infer<typeof MultiFactorService.MultiFactorBodySchema>,
    ip: string,
    userAgent: string,
  ): Promise<z.infer<typeof MultiFactorService.RemoveRespSchema>> => {
    // 与 confirmRecoveryCodes / clear 共用状态锁：避免刚删除的恢复码被并发的确认又写回去
    return cache.lock(`${STATE_KEY_PREFIX}${userId}`, async () => {
      await MultiFactorService.verifyMultiFactorOrThrow({
        userId,
        mfa: body,
        ip,
        userAgent,
      })
      await UserMultiFactorRepository.removeByUserId(userId, 'recovery_code')
      return { success: true }
    })
  }

  /**
   * 管理员清除用户的多因素验证
   *
   * @param userId 用户id
   */
  static clearAll = async (userId: string): Promise<void> => {
    // 与 confirmTotp 串行，避免重置后用户正在确认的验证器又被写回
    await cache.lock(`${STATE_KEY_PREFIX}${userId}`, async () => {
      await UserMultiFactorRepository.removeByUserId(userId)
      await cache.del(`${SETUP_TOTP_KEY_PREFIX}${userId}`)
      await cache.del(`${SETUP_RECOVERY_KEY_PREFIX}${userId}`)
    })
  }
}
