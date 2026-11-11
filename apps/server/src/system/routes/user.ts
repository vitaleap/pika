import { Elysia } from 'elysia'
import { requestIpPlugin } from '@pika/elysia-plugins'
import { UserService } from '@/system/services/user'
import { UserPreferenceService } from '@/system/services/user-preference'
import { t } from '@/common/plugins/i18n'
import { rateLimit } from '@/common/rate-limit'
import { auth } from '@/common/plugins/auth'

export const userRouter = new Elysia({
  prefix: '/user',
  detail: {
    tags: ['user'],
    security: [{ 'HTTP Bearer': [] }],
  },
})
  .use(requestIpPlugin())
  .use(auth())
  .post(
    '/edit',
    {
      detail: {
        operationId: 'edit',
        summary: 'Edit user profile',
      },
      body: UserService.EditBodySchema,
      response: UserService.EditRespSchema,
    },
    ({ body, user }) => UserService.edit(user.sub, body),
  )
  .post(
    '/edit/email',
    {
      detail: {
        operationId: 'editEmail',
        summary: 'Edit user email',
      },
      body: UserService.EditEmailBodySchema,
      response: UserService.EditEmailRespSchema,
    },
    async ({ body, user, requestIp }) => {
      await rateLimit(
        { second: 10, minute: 20, errorMessage: t('SYSTEM.REQUEST_RATE_LIMITED_MINUTE') },
        `edit_email:${requestIp}`,
      )
      return UserService.editEmail(user.sub, body)
    },
  )
  .post(
    '/edit/phone',
    {
      detail: {
        operationId: 'editPhone',
        summary: 'Edit user phone',
      },
      body: UserService.EditPhoneBodySchema,
      response: UserService.EditPhoneRespSchema,
    },
    async ({ body, user, requestIp }) => {
      await rateLimit(
        { second: 10, minute: 20, errorMessage: t('SYSTEM.REQUEST_RATE_LIMITED_MINUTE') },
        `edit_phone:${requestIp}`,
      )
      return UserService.editPhone(user.sub, body)
    },
  )
  .post(
    '/check/email',
    {
      detail: {
        operationId: 'checkEmail',
        summary: 'Check email availability',
      },
      body: UserService.CheckEmailBodySchema,
      response: UserService.CheckEmailRespSchema,
    },
    async ({ body, user }) => {
      await rateLimit(
        { minute10: 20, errorMessage: t('SYSTEM.REQUEST_RATE_LIMITED') },
        `check_email:${user.sub}`,
      )
      return UserService.checkEmail(user.sub, body)
    },
  )
  .post(
    '/check/phone',
    {
      detail: {
        operationId: 'checkPhone',
        summary: 'Check phone availability',
      },
      body: UserService.CheckPhoneBodySchema,
      response: UserService.CheckPhoneRespSchema,
    },
    async ({ body, user }) => {
      await rateLimit(
        { minute10: 20, errorMessage: t('SYSTEM.REQUEST_RATE_LIMITED') },
        `check_phone:${user.sub}`,
      )
      return UserService.checkPhone(user.sub, body)
    },
  )
  .get(
    '/preference',
    {
      detail: {
        operationId: 'getPreference',
        summary: 'Get user preference',
      },
      response: UserPreferenceService.GetRespSchema,
    },
    ({ user }) => UserPreferenceService.get(user.sub),
  )
  .post(
    '/preference',
    {
      detail: {
        operationId: 'savePreference',
        summary: 'Save user preference',
      },
      body: UserPreferenceService.SaveBodySchema,
      response: UserPreferenceService.SaveRespSchema,
    },
    ({ body, user }) => UserPreferenceService.save(user.sub, body),
  )
