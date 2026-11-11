import { Elysia } from 'elysia'
import { auth } from '@/common/plugins/auth'
import { AdminUserService } from '@/system/services/admin-user'

export const adminUserRouter = new Elysia({
  prefix: '/admin/user',
  detail: {
    tags: ['admin-user'],
    description: '用户管理',
    security: [{ 'HTTP Bearer': [] }],
  },
})
  .use(auth({ role: 'admin' }))
  .get(
    '/',
    {
      detail: {
        operationId: 'list',
        summary: '获取用户列表',
      },
      query: AdminUserService.ListQuerySchema,
      response: AdminUserService.ListRespSchema,
    },
    ({ query }) => AdminUserService.list(query),
  )
  .put(
    '/:id',
    {
      detail: {
        operationId: 'update',
        summary: '全量更新用户',
      },
      params: AdminUserService.IdParamsSchema,
      body: AdminUserService.UpdateBodySchema,
      response: AdminUserService.UpdateRespSchema,
    },
    ({ params, body }) => AdminUserService.update(params.id, body),
  )
  .patch(
    '/:id/password',
    {
      detail: {
        operationId: 'resetPassword',
        summary: '重置用户密码',
      },
      params: AdminUserService.IdParamsSchema,
      body: AdminUserService.ResetPasswordBodySchema,
      response: AdminUserService.ResetPasswordRespSchema,
    },
    ({ params, body }) => AdminUserService.resetPassword(params.id, body),
  )
  .delete(
    '/:id',
    {
      detail: {
        operationId: 'remove',
        summary: '删除用户',
      },
      params: AdminUserService.IdParamsSchema,
      response: AdminUserService.RemoveRespSchema,
    },
    ({ params, user }) => AdminUserService.remove(params.id, user.sub),
  )
