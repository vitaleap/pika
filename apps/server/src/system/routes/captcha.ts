import { Elysia } from 'elysia'
import { requestIpPlugin } from '@pika/elysia-plugins'
import { CaptchaService } from '@/system/services/captcha'
import { t } from '@/common/plugins/i18n'
import { rateLimit } from '@/common/rate-limit'

export const captchaRouter = new Elysia({
  prefix: '/captcha',
  detail: {
    tags: ['captcha'],
  },
})
  .use(requestIpPlugin())
  .post(
    '/gen',
    {
      detail: {
        operationId: 'gen',
        summary: 'Generate captcha',
      },
      response: CaptchaService.CaptchaGenRespSchema,
    },
    async ({ requestIp }) => {
      await rateLimit(
        { second: 10, minute: 20, errorMessage: t('SYSTEM.REQUEST_RATE_LIMITED_MINUTE') },
        `captcha:gen:${requestIp}`,
      )
      return CaptchaService.captchaGen()
    },
  )
  .post(
    '/verify',
    {
      detail: {
        operationId: 'verify',
        summary: 'Verify captcha',
      },
      body: CaptchaService.CaptchaVerifySchema,
      response: CaptchaService.CaptchaVerifyRespSchema,
    },
    async ({ body, requestIp }) => {
      await rateLimit(
        { minute: 10, errorMessage: t('SYSTEM.REQUEST_RATE_LIMITED') },
        `captcha:verify:${requestIp}`,
      )
      const success = await CaptchaService.captchaVerify(body)
      return { success }
    },
  )
