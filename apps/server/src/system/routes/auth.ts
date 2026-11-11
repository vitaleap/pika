import { Elysia } from 'elysia'
import { z } from 'zod'
import { HttpError, requestIpPlugin, type JwtPayload } from '@pika/elysia-plugins'
import { t } from '@/common/plugins/i18n'
import { cache } from '@/common/cache'
import { config } from '@/common/config'
import { DEV_TEST_USER, isDevTestUser } from '@/common/utils/dev-user'
import { rateLimit } from '@/common/rate-limit'
import { AuthService } from '@/system/services/auth'
import { UserRepository } from '@/system/repositories/user'
import { md5 } from '@/common/utils/crypto'
import { auth, getRoles } from '@/common/plugins/auth'

export const authRouter = new Elysia({
  prefix: '/oauth',
  detail: {
    tags: ['auth'],
    security: [{ 'HTTP Bearer': [] }],
  },
})
  .use(requestIpPlugin())
  .use(
    auth({
      excludePaths: [
        '/oauth/token',
        '/oauth/reg/email',
        '/oauth/reg/phone',
        '/oauth/send/code',
        '/oauth/forget/password',
      ],
    }),
  )
  .post(
    '/token',
    {
      detail: {
        operationId: 'token',
        summary: 'Get access token',
      },
      headers: AuthService.TokenHeadersSchema,
      body: AuthService.TokenBodySchema,
      response: AuthService.TokenRespSchema,
    },
    async ({ body, jwt, request, requestIp }) => {
      const userAgent = request.headers.get('user-agent') ?? undefined
      let user: JwtPayload | undefined

      switch (body.grant_type) {
        case 'password':
          user = await AuthService.oauthPassword(body, requestIp, userAgent)
          break
        case 'phone_code':
          user = await AuthService.oauthPhoneCode(body, requestIp, userAgent)
          break
        case 'email_code':
          user = await AuthService.oauthEmailCode(body, requestIp, userAgent)
          break
        case 'refresh_token':
          user = await AuthService.oauthRefreshToken(await jwt.verify(body.refresh_token))
          break
        case 'authorization_code':
          throw new HttpError(t('SYSTEM.NOT_SUPPORTED'), 400)
        default:
          // schema 已通过但暂未实现的 grant_type，留空由下方 `if (!user)` 兜底
          break
      }

      if (!user) {
        throw new HttpError(t('SYSTEM.UNAUTHORIZED'), 401)
      }

      const tokenUser = {
        ...user,
        roles: await getRoles(user),
      }
      const signToken = async (exp: string, rfh?: true) => {
        return await jwt.sign({
          ...tokenUser,
          exp,
          iat: true,
          // 仅在传入时附带 rfh，避免显式传入 undefined 而触发索引签名不兼容
          ...(rfh !== undefined && { rfh }),
        })
      }

      const accessToken = await signToken(config.jwt.expires)
      const refreshToken = await signToken(config.jwt.refreshExpires, true)
      const scope = 'scope' in body ? body.scope : undefined

      return {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: config.jwt.expires,
        refresh_token: refreshToken,
        id_token: scope?.includes('openid') ? accessToken : undefined,
      }
    },
  )
  .get(
    '/userinfo',
    {
      detail: {
        operationId: 'userinfo',
        summary: 'Get current userinfo',
      },
      response: z.object({
        sub: z.string().describe('唯一标识，类似于用户id'),
        name: z.string().describe('名称'),
        picture: z.string().describe('头像'),
        roles: z.array(z.string()).describe('角色'),
        email: z.string().optional().describe('邮箱'),
        email_verified: z.boolean().optional().describe('邮箱是否已认证'),
        phone_number: z.string().optional().describe('手机号'),
        phone_number_verified: z.boolean().optional().describe('手机号是否已认证'),
      }),
    },
    async ({ user }) => {
      if (isDevTestUser(user)) {
        return {
          sub: user.sub,
          name: user.name,
          email: DEV_TEST_USER.email,
          picture: `${config.basePath}/system/file/avatar/${md5(DEV_TEST_USER.email)}.png`,
          roles: await getRoles(user),
        }
      }

      const userInfo = await cache.getOrSet(
        user.sub,
        () => UserRepository.findById(user.sub),
        '10s',
      )
      if (!userInfo) {
        throw new HttpError(t('SYSTEM.USER_NOT_FOUND'), 401)
      }
      return {
        sub: userInfo.id,
        name: userInfo.name,
        email: userInfo.email ?? undefined,
        email_verified: userInfo.emailVerified,
        phone_number: userInfo.phoneNumber ?? undefined,
        phone_number_verified: userInfo.phoneNumberVerified,
        picture:
          userInfo.picture ||
          `${config.basePath}/system/file/avatar/${md5(userInfo.email ?? userInfo.id)}.png`,
        roles: await getRoles(user),
      }
    },
  )
  .post(
    '/send/code',
    {
      detail: {
        operationId: 'sendCode',
        summary: 'Send verification code',
      },
      body: AuthService.SendCodeSchema,
    },
    async ({ body, requestIp }) => {
      await rateLimit(
        {
          second: 5,
          minute: 10,
          hour: 20,
          errorMessage: t('SYSTEM.SEND_CODE_RATE_LIMITED_MINUTE'),
        },
        `send_code:${requestIp}`,
      )
      if (body.channel === 'email') {
        await AuthService.sendCodeEmail(body)
      } else if (body.channel === 'phone') {
        await AuthService.sendCodePhone(body)
      } else {
        throw new HttpError(t('SYSTEM.NOT_SUPPORTED'), 400)
      }
      return { status: 'ok' }
    },
  )
  .post(
    '/reg/email',
    {
      detail: {
        operationId: 'regEmail',
        summary: 'Register with email',
      },
      body: AuthService.RegisterEmailSchema,
      response: AuthService.RegisterEmailRespSchema,
    },
    async ({ body, requestIp }) => {
      await rateLimit(
        { second: 10, minute: 20, errorMessage: t('SYSTEM.REQUEST_RATE_LIMITED_MINUTE') },
        `reg_email:${requestIp}`,
      )
      const res = await AuthService.registerEmail(body)
      return { status: 'ok', createAt: res.createAt }
    },
  )
  .post(
    '/reg/phone',
    {
      detail: {
        operationId: 'regPhone',
        summary: 'Register with phone',
      },
      body: AuthService.RegisterPhoneSchema,
      response: AuthService.RegisterPhoneRespSchema,
    },
    async ({ body, requestIp }) => {
      await rateLimit(
        { second: 10, minute: 20, errorMessage: t('SYSTEM.REQUEST_RATE_LIMITED_MINUTE') },
        `reg_phone:${requestIp}`,
      )
      const res = await AuthService.registerPhone(body)
      return { status: 'ok', createAt: res.createAt }
    },
  )
  .post(
    '/forget/password',
    {
      detail: {
        operationId: 'forgetPassword',
        summary: 'Reset password',
      },
      body: AuthService.ForgetPasswordSchema,
    },
    async ({ body, requestIp }) => {
      await rateLimit(
        { second: 10, minute: 20, errorMessage: t('SYSTEM.REQUEST_RATE_LIMITED_MINUTE') },
        `forget_password:${requestIp}`,
      )
      await AuthService.forgetPassword(body)
      return { status: 'ok' }
    },
  )
