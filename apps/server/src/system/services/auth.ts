import dayjs from 'dayjs'
import { z } from 'zod'
import { UserRepository } from '@/system/repositories/user'
import { UserLoginLogRepository } from '@/system/repositories/user-login-log'
import { loginFailReasons } from '@/system/schemas/user-login-log'
import { ConfigService } from '@/system/services/config'
import { t } from '@/common/plugins/i18n'
import type { JwtPayload } from '@/common/plugins/auth'
import { cache } from '@/common/cache'
import { withTransaction } from '@/common/db'
import { CaptchaService } from './captcha'
import { EmailService } from './email'
import { SmsService } from './sms'
import {
  MultiFactorError,
  MultiFactorService,
  mfaSchema,
  type MultiFactorVerify,
} from './multi-factor'
import { emailSchema, passwordSchema } from '@/system/utils/validation'
import { HttpError } from '@pika/elysia-plugins'
import { zodDayjs } from '@/common/zod'
import { isEmail, isPhone, validateEmail } from '@pika/shared'
import { hashPassword, verifyPassword } from '@/common/utils/crypto'

type LoginType = 'password' | 'phone_code' | 'email_code'

/** 根据登录日志判断，失败次数过多时拒绝登录，避免暴力破解 */
const assertLoginAllowed = async (ip: string, username: string): Promise<void> => {
  const recentFails = await UserLoginLogRepository.countRecentFailures(ip, username, 10)
  if (recentFails >= 10) {
    throw new HttpError(t('SYSTEM.LOGIN_RATE_LIMITED'), 429)
  }
}

/** 已开启多因素验证时校验第二因素，失败时写入登录失败日志 */
const assertLoginMultiFactor = async (
  user: { id: string; loginMultiFactorEnabled: boolean },
  mfa: Partial<MultiFactorVerify> | undefined,
  log: { username: string; ip: string; userAgent: string; loginType: LoginType },
): Promise<void> => {
  // 判断开启登录验证，且存在多因素验证
  const { hasMultiFactor } = await MultiFactorService.hasMultiFactor(user.id)
  if (!user.loginMultiFactorEnabled || !hasMultiFactor) {
    return
  }
  try {
    await MultiFactorService.verifyMultiFactorOrThrow({
      userId: user.id,
      mfa: mfa,
      ip: log.ip,
      userAgent: log.userAgent,
    })
  } catch (error) {
    // 「需要补充第二因素」是登录流程的中间态，不计入失败次数，也不污染安全审计日志
    if (error instanceof MultiFactorError && error.reason === 'required') {
      throw error
    }
    await UserLoginLogRepository.save({
      ...log,
      userId: user.id,
      success: false,
      failReason:
        error instanceof MultiFactorError
          ? (error.reasonMsg ?? loginFailReasons.multiFactorIncorrect)
          : loginFailReasons.multiFactorIncorrect,
    })
    throw error
  }
}

/** 构造 JWT 载荷；email 为空时跳过键，避免索引签名不兼容 */
const toJwtPayload = (user: { id: string; name: string; email?: string | null }): JwtPayload => {
  return {
    sub: user.id,
    name: user.name,
    ...(user.email != null && { email: user.email }),
  }
}

/** 登录成功后更新登录时间、写入成功日志并返回 JWT 载荷 */
const finishLogin = async (
  user: { id: string; name: string; email?: string | null },
  log: { username: string; ip: string; userAgent: string; loginType: LoginType },
): Promise<JwtPayload> => {
  // 事务内的 repository 会自动加入同一事务，无需传 tx
  await withTransaction(async () => {
    await UserRepository.updateById(user.id, { loginAt: dayjs() })
    await UserLoginLogRepository.save({
      username: log.username,
      userId: user.id,
      ip: log.ip,
      userAgent: log.userAgent,
      loginType: log.loginType,
      success: true,
    })
  })
  return toJwtPayload(user)
}

export abstract class AuthService {
  static OAuthTokenPasswordSchema = z
    .object({
      grant_type: z.literal('password'),
      username: z.string().trim().min(1, t('SYSTEM.USERNAME_REQUIRED')),
      password: z.string().min(1, t('SYSTEM.PASSWORD_REQUIRED')),
      scope: z.string().optional(),
    })
    .extend(mfaSchema.shape)

  static OAuthAuthorizationCodeSchema = z.object({
    grant_type: z.literal('authorization_code'),
    code: z.string().min(1, t('SYSTEM.AUTHORIZATION_CODE_REQUIRED')),
    redirect_uri: z.url(t('SYSTEM.REDIRECT_URI_INVALID')),
    client_id: z.string(),
    client_secret: z.string(),
    scope: z.string().optional(),
  })

  static OAuthTokenPhoneCodeSchema = z
    .object({
      grant_type: z.literal('phone_code'),
      phone: z
        .string()
        .min(1, t('SYSTEM.PHONE_REQUIRED'))
        .refine(isPhone, t('SYSTEM.PHONE_INVALID')),
      code: z.string().min(1, t('SYSTEM.VERIFICATION_CODE_REQUIRED')),
      scope: z.string().optional(),
    })
    .extend(mfaSchema.shape)

  static OAuthTokenEmailCodeSchema = z
    .object({
      grant_type: z.literal('email_code'),
      email: emailSchema,
      code: z.string().min(1, t('SYSTEM.VERIFICATION_CODE_REQUIRED')),
      scope: z.string().optional(),
    })
    .extend(mfaSchema.shape)

  static TokenHeadersSchema = z
    .object({ authorization: z.string().optional() })
    .or(z.record(z.string(), z.string()))

  static TokenBodySchema = z.discriminatedUnion('grant_type', [
    AuthService.OAuthTokenPasswordSchema,
    AuthService.OAuthTokenPhoneCodeSchema,
    AuthService.OAuthTokenEmailCodeSchema,
    AuthService.OAuthAuthorizationCodeSchema,
    z.object({
      grant_type: z.literal('refresh_token'),
      refresh_token: z.string().min(1, t('SYSTEM.REFRESH_TOKEN_REQUIRED')),
    }),
    z.object({
      grant_type: z.enum(['client_credentials', 'device_code']),
      scope: z.string().optional(),
    }),
  ])

  static TokenRespSchema = z.object({
    access_token: z.string(),
    refresh_token: z.string(),
    token_type: z.enum(['Bearer']),
    expires_in: z.string(),
    id_token: z.string().optional(),
  })

  static oauthPassword = async (
    body: z.infer<typeof AuthService.OAuthTokenPasswordSchema>,
    ip: string,
    userAgent: string,
  ): Promise<JwtPayload> => {
    const usernameIsEmail = isEmail(body.username)
    const username = usernameIsEmail ? body.username.toLowerCase() : body.username

    await assertLoginAllowed(ip, username)

    const user = usernameIsEmail
      ? await UserRepository.findByEmail(username)
      : await UserRepository.findByPhone(username)
    if (!user) {
      await UserLoginLogRepository.save({
        username,
        ip,
        userAgent,
        loginType: 'password',
        success: false,
        failReason: loginFailReasons.userNotFound,
      })
      throw new HttpError(t('SYSTEM.ACCOUNT_OR_PASSWORD_INCORRECT'), 401)
    }

    const isPasswordValid =
      user.password !== null && (await verifyPassword(body.password, user.password))
    if (!isPasswordValid) {
      await UserLoginLogRepository.save({
        username,
        userId: user.id,
        ip,
        userAgent,
        loginType: 'password',
        success: false,
        failReason: loginFailReasons.passwordIncorrect,
      })
      // 与“账号不存在”保持同一文案，避免账号枚举
      throw new HttpError(t('SYSTEM.ACCOUNT_OR_PASSWORD_INCORRECT'), 401)
    }

    // 开启多因素验证后，每次登录都需在同一请求中带上验证方式与验证码
    await assertLoginMultiFactor(user, body, {
      username,
      ip,
      userAgent,
      loginType: 'password',
    })

    return finishLogin(user, {
      username,
      ip,
      userAgent,
      loginType: 'password',
    })
  }

  // 验证码与多因素验证通过后删除缓存，并记录登录结果
  private static _oauthCodeLogin = async (
    body: {
      username: string
      code: string
      loginType: Exclude<LoginType, 'password'>
      mfa: Partial<MultiFactorVerify> | undefined
    },
    ip: string,
    userAgent: string,
  ): Promise<JwtPayload> => {
    const { username, code, loginType, mfa } = body
    await assertLoginAllowed(ip, username)

    const isEmailLogin = loginType === 'email_code'
    const user = isEmailLogin
      ? await UserRepository.findByEmail(username)
      : await UserRepository.findByPhone(username)
    if (!user) {
      await UserLoginLogRepository.save({
        username,
        ip,
        userAgent,
        loginType,
        success: false,
        failReason: loginFailReasons.userNotFound,
      })
      // 与[验证码错误]保持同一文案，避免账号枚举
      throw new HttpError(t('SYSTEM.VERIFICATION_CODE_INCORRECT'), 401)
    }

    const codeStore = isEmailLogin ? EmailService : SmsService
    // 同一用户的验证码消费需串行，否则并发请求能同时通过校验
    await cache.lock(`user:${user.id}:login_code`, async () => {
      try {
        // 多因素验证通过后才消费验证码，否则用户取消验证后需要重新发送
        await codeStore.verifyCodeAutoDelete(username, code, false)
      } catch (error) {
        await UserLoginLogRepository.save({
          username,
          userId: user.id,
          ip,
          userAgent,
          loginType,
          success: false,
          failReason: loginFailReasons.verificationCodeIncorrect,
        })
        throw error
      }

      // 验证码登录同样需要第二因素，避免已开启多因素验证的账号绕过校验
      await assertLoginMultiFactor(user, mfa, { username, ip, userAgent, loginType })
      await codeStore.deleteCode(username)
    })

    return finishLogin(user, { username, ip, userAgent, loginType })
  }

  static oauthPhoneCode = async (
    body: z.infer<typeof AuthService.OAuthTokenPhoneCodeSchema>,
    ip: string,
    userAgent: string,
  ): Promise<JwtPayload> => {
    return AuthService._oauthCodeLogin(
      {
        username: body.phone,
        code: body.code,
        loginType: 'phone_code',
        mfa: body,
      },
      ip,
      userAgent,
    )
  }

  static oauthEmailCode = async (
    body: z.infer<typeof AuthService.OAuthTokenEmailCodeSchema>,
    ip: string,
    userAgent: string,
  ): Promise<JwtPayload> => {
    return AuthService._oauthCodeLogin(
      {
        username: body.email.toLowerCase(),
        code: body.code,
        loginType: 'email_code',
        mfa: body,
      },
      ip,
      userAgent,
    )
  }

  static oauthRefreshToken = async (user?: JwtPayload | false): Promise<JwtPayload> => {
    if (!user || user.rfh !== true) {
      throw new HttpError(t('SYSTEM.INVALID_TOKEN'), 401)
    }

    const currentUser = await UserRepository.findById(user.sub)
    if (!currentUser) {
      throw new HttpError(t('SYSTEM.INVALID_TOKEN'), 401)
    }
    return toJwtPayload(currentUser)
  }

  static SendCodeSchema = z.discriminatedUnion('channel', [
    z.object({
      channel: z.literal('email'),
      email: emailSchema,
      uniqueId: z.string().min(1, t('SYSTEM.UNIQUE_ID_REQUIRED')),
    }),
    z.object({
      channel: z.literal('phone'),
      phone: z
        .string()
        .min(1, t('SYSTEM.PHONE_REQUIRED'))
        .refine(isPhone, t('SYSTEM.PHONE_INVALID')),
      uniqueId: z.string().min(1, t('SYSTEM.UNIQUE_ID_REQUIRED')),
    }),
  ])

  static sendCodeEmail = async (body: { email: string; uniqueId: string }) => {
    const email = body.email.toLowerCase().trim()
    const validateResult = validateEmail(email)
    if (validateResult.isEmail === false) {
      throw new HttpError(t('SYSTEM.EMAIL_INVALID'), 400)
    }
    if (validateResult.isValidDomain === false) {
      throw new HttpError(t('SYSTEM.EMAIL_DOMAIN_UNSUPPORTED'), 400)
    }
    return cache.lock(email, async () => {
      await AuthService.verifyCaptcha(body.uniqueId)
      await EmailService.sendCode(email)
    })
  }

  static sendCodePhone = async (body: { phone: string; uniqueId: string }) => {
    return cache.lock(body.phone, async () => {
      await AuthService.verifyCaptcha(body.uniqueId)
      await SmsService.sendCode(body.phone)
    })
  }

  private static verifyCaptcha = async (uniqueId: string): Promise<void> => {
    await CaptchaService.captchaVerifySuccess(uniqueId)
  }

  static RegisterPhoneSchema = z.object({
    phone: z.string().min(1, t('SYSTEM.PHONE_REQUIRED')).refine(isPhone, t('SYSTEM.PHONE_INVALID')),
    password: passwordSchema,
    code: z.string().min(1, t('SYSTEM.VERIFICATION_CODE_REQUIRED')),
  })

  static RegisterPhoneRespSchema = z.object({ status: z.literal('ok'), createAt: zodDayjs() })

  static registerPhone = async (body: z.infer<typeof AuthService.RegisterPhoneSchema>) => {
    const { auth } = await ConfigService.get()
    if (!auth.regEnabled) {
      throw new HttpError(t('SYSTEM.NOT_FOUND'), 404)
    }
    if (auth.regType !== 'phone') {
      throw new HttpError(t('SYSTEM.REG_TYPE_EMAIL_ONLY'), 400)
    }
    return cache.lock(body.phone, async () => {
      const existing = await UserRepository.findByPhone(body.phone)
      if (existing) {
        throw new HttpError(t('SYSTEM.PHONE_ALREADY_EXISTS'), 409)
      }
      await SmsService.verifyCodeAutoDelete(body.phone, body.code, false)
      const createAt = dayjs()
      const user = await UserRepository.save({
        // 手机号注册时昵称默认为手机号后 6 位
        name: body.phone.slice(-6),
        phoneNumber: body.phone,
        phoneNumberVerified: true,
        createAt,
        password: await hashPassword(body.password),
      })
      // 注册成功后消费验证码，避免在有效期内被重复使用
      await SmsService.deleteCode(body.phone)
      return user
    })
  }

  static RegisterEmailSchema = z.object({
    email: emailSchema,
    password: passwordSchema,
    code: z.string().min(1, t('SYSTEM.VERIFICATION_CODE_REQUIRED')),
  })

  static RegisterEmailRespSchema = z.object({ status: z.literal('ok'), createAt: zodDayjs() })

  static registerEmail = async (body: z.infer<typeof AuthService.RegisterEmailSchema>) => {
    const { auth } = await ConfigService.get()
    if (!auth.regEnabled) {
      throw new HttpError(t('SYSTEM.NOT_FOUND'), 404)
    }
    if (auth.regType !== 'email') {
      throw new HttpError(t('SYSTEM.REG_TYPE_PHONE_ONLY'), 400)
    }
    const email = body.email.toLowerCase().trim()
    const validateResult = validateEmail(email)
    if (validateResult.isEmail === false) {
      throw new HttpError(t('SYSTEM.EMAIL_INVALID'), 400)
    }
    if (validateResult.isValidDomain === false) {
      throw new HttpError(t('SYSTEM.EMAIL_DOMAIN_UNSUPPORTED'), 400)
    }
    return cache.lock(email, async () => {
      const existing = await UserRepository.findByEmail(email)
      if (existing) {
        throw new HttpError(t('SYSTEM.EMAIL_ALREADY_EXISTS'), 409)
      }
      await EmailService.verifyCodeAutoDelete(email, body.code, false)
      const createAt = dayjs()
      const user = await UserRepository.save({
        name: email.split('@')[0]!,
        email,
        emailVerified: true,
        createAt,
        password: await hashPassword(body.password),
      })
      // 注册成功后消费验证码，避免在有效期内被重复使用
      await EmailService.deleteCode(email)
      return user
    })
  }

  static ForgetPasswordSchema = z.discriminatedUnion('channel', [
    z.object({
      channel: z.literal('email'),
      email: emailSchema,
      password: passwordSchema,
      code: z.string().min(1, t('SYSTEM.VERIFICATION_CODE_REQUIRED')),
    }),
    z.object({
      channel: z.literal('phone'),
      phone: z
        .string()
        .min(1, t('SYSTEM.PHONE_REQUIRED'))
        .refine(isPhone, t('SYSTEM.PHONE_INVALID')),
      password: passwordSchema,
      code: z.string().min(1, t('SYSTEM.VERIFICATION_CODE_REQUIRED')),
    }),
  ])

  static forgetPassword = async (body: z.infer<typeof AuthService.ForgetPasswordSchema>) => {
    if (body.channel === 'email') {
      const email = body.email.toLowerCase().trim()
      return cache.lock(email, async () => {
        await EmailService.verifyCodeAutoDelete(email, body.code, false)
        const user = await UserRepository.findByEmail(email)
        if (!user) {
          throw new HttpError(t('SYSTEM.USER_NOT_FOUND'), 404)
        }
        await UserRepository.updateById(user.id, { password: await hashPassword(body.password) })
        await EmailService.deleteCode(email)
      })
    }
    return cache.lock(body.phone, async () => {
      await SmsService.verifyCodeAutoDelete(body.phone, body.code, false)
      const user = await UserRepository.findByPhone(body.phone)
      if (!user) {
        throw new HttpError(t('SYSTEM.USER_NOT_FOUND'), 404)
      }
      await UserRepository.updateById(user.id, { password: await hashPassword(body.password) })
      await SmsService.deleteCode(body.phone)
    })
  }
}
