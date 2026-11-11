import { Elysia } from 'elysia'
import { ConfigService } from '@/system/services/config'
import { auth } from '@/common/plugins/auth'

export const adminConfigRouter = new Elysia({
  prefix: '/admin/config',
  detail: {
    tags: ['admin-config'],
    description: '系统配置管理',
    security: [{ 'HTTP Bearer': [] }],
  },
})
  .use(auth({ role: 'admin' }))
  .get(
    '/',
    {
      detail: {
        operationId: 'get',
        summary: '获取系统配置',
      },
      response: ConfigService.GetRespSchema,
    },
    () => ConfigService.get(),
  )
  .patch(
    '/',
    {
      detail: {
        operationId: 'update',
        summary: '更新系统配置',
      },
      body: ConfigService.UpdateBodySchema,
      response: ConfigService.UpdateRespSchema,
    },
    ({ body }) => ConfigService.update(body),
  )
  .post(
    '/reset',
    {
      detail: {
        operationId: 'reset',
        summary: '重置系统配置为默认值',
      },
      response: ConfigService.ResetRespSchema,
    },
    () => ConfigService.reset(),
  )
