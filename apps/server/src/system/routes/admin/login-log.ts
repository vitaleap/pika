import { Elysia } from 'elysia'
import { auth } from '@/common/plugins/auth'
import { i18nPlugin } from '@/common/plugins/i18n'
import { AdminLoginLogService } from '@/system/services/admin-login-log'

export const adminLoginLogRouter = new Elysia({
  prefix: '/admin/login-log',
  detail: {
    tags: ['admin-login-log'],
    description: '登录日志管理',
    security: [{ 'HTTP Bearer': [] }],
  },
})
  .use(auth({ role: 'admin' }))
  // 插件已在 app.ts 全局挂载；这里再 use 仅用于推导请求上下文中的 i18n
  .use(i18nPlugin)
  .get(
    '/',
    {
      detail: {
        operationId: 'list',
        summary: '获取登录日志列表',
      },
      query: AdminLoginLogService.ListQuerySchema,
      response: AdminLoginLogService.ListRespSchema,
    },
    ({ query, i18n }) => AdminLoginLogService.list(query, i18n.locale),
  )
