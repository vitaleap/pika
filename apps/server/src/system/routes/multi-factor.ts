import { Elysia } from 'elysia'
import { requestIpPlugin } from '@pika/elysia-plugins'
import { auth } from '@/common/plugins/auth'
import { rateLimit } from '@/common/rate-limit'
import { t } from '@/common/plugins/i18n'
import { MultiFactorService } from '@/system/services/multi-factor'

/** 读取 User-Agent，用于多因素验证日志 */
const userAgentOf = (request: Request): string => request.headers.get('user-agent') ?? ''

export const multiFactorRouter = new Elysia({
  prefix: '/multi-factor',
  detail: {
    tags: ['multi-factor'],
    security: [{ 'HTTP Bearer': [] }],
  },
})
  .use(requestIpPlugin())
  .use(auth())
  .get(
    '/',
    {
      detail: {
        operationId: 'getMultiFactor',
        summary: 'Get multi-factor status',
      },
      response: MultiFactorService.StatusRespSchema,
    },
    ({ user }) => MultiFactorService.getStatus(user.sub),
  )
  .patch(
    '/',
    {
      detail: {
        operationId: 'toggleMultiFactor',
        summary: 'Enable or disable two-step verification',
      },
      body: MultiFactorService.ToggleBodySchema,
      response: MultiFactorService.ToggleRespSchema,
    },
    ({ user, body, requestIp, request }) =>
      MultiFactorService.setEnabled(user.sub, body, requestIp, userAgentOf(request)),
  )
  .post(
    '/totp/setup',
    {
      detail: {
        operationId: 'setupMultiFactorTotp',
        summary: 'Start authenticator (TOTP) setup',
      },
      body: MultiFactorService.MultiFactorBodySchema,
      response: MultiFactorService.SetupTotpRespSchema,
    },
    async ({ user, body, requestIp, request }) => {
      await rateLimit(
        { minute: 10, errorMessage: t('SYSTEM.REQUEST_RATE_LIMITED_MINUTE') },
        `multi_factor_setup:${requestIp}`,
      )
      return MultiFactorService.setupTotp(user.sub, body, requestIp, userAgentOf(request))
    },
  )
  .post(
    '/totp/confirm',
    {
      detail: {
        operationId: 'confirmMultiFactorTotp',
        summary: 'Confirm authenticator (TOTP) setup',
      },
      body: MultiFactorService.ConfirmTotpBodySchema,
      response: MultiFactorService.ConfirmTotpRespSchema,
    },
    async ({ user, body }) => {
      await rateLimit(
        { minute10: 20, errorMessage: t('SYSTEM.REQUEST_RATE_LIMITED') },
        `multi_factor_confirm:${user.sub}`,
      )
      return MultiFactorService.confirmTotp(user.sub, body)
    },
  )
  .post(
    '/totp/remove',
    {
      detail: {
        operationId: 'removeMultiFactorTotp',
        summary: 'Remove authenticator (TOTP)',
      },
      body: MultiFactorService.MultiFactorBodySchema,
      response: MultiFactorService.RemoveRespSchema,
    },
    ({ user, body, requestIp, request }) =>
      MultiFactorService.removeTotp(user.sub, body, requestIp, userAgentOf(request)),
  )
  .post(
    '/recovery-code/generate',
    {
      detail: {
        operationId: 'generateMultiFactorRecoveryCodes',
        summary: 'Generate recovery codes',
      },
      body: MultiFactorService.MultiFactorBodySchema,
      response: MultiFactorService.GenerateRecoveryCodesRespSchema,
    },
    async ({ user, body, requestIp, request }) => {
      await rateLimit(
        { minute: 10, errorMessage: t('SYSTEM.REQUEST_RATE_LIMITED_MINUTE') },
        `multi_factor_recovery:${user.sub}`,
      )
      return MultiFactorService.generateRecoveryCodes(
        user.sub,
        body,
        requestIp,
        userAgentOf(request),
      )
    },
  )
  .post(
    '/recovery-code/confirm',
    {
      detail: {
        operationId: 'confirmMultiFactorRecoveryCodes',
        summary: 'Confirm recovery codes have been saved',
      },
      body: MultiFactorService.ConfirmRecoveryCodesBodySchema,
      response: MultiFactorService.ConfirmRecoveryCodesRespSchema,
    },
    ({ user, body }) => MultiFactorService.confirmRecoveryCodes(user.sub, body),
  )
  .post(
    '/recovery-code/remove',
    {
      detail: {
        operationId: 'removeMultiFactorRecoveryCodes',
        summary: 'Remove recovery codes',
      },
      body: MultiFactorService.MultiFactorBodySchema,
      response: MultiFactorService.RemoveRespSchema,
    },
    ({ user, body, requestIp, request }) =>
      MultiFactorService.removeRecoveryCodes(user.sub, body, requestIp, userAgentOf(request)),
  )
