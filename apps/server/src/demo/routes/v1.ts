import { Elysia } from 'elysia'
import dayjs from 'dayjs'
import { z } from 'zod'
import { snowflake } from '@/common/snowflake'
import { zodDayjs } from '@/common/zod'
import { log } from '@/common/log'
import { i18nPlugin } from '@/common/plugins/i18n'
import { requestIpPlugin } from '@pika/elysia-plugins'

const startTime = dayjs()

export const v1Router = new Elysia({
  prefix: '/v1',
  detail: {
    tags: ['health'],
    description: 'demo接口',
  },
})
  // 插件已在 app.ts 全局挂载；这里再 use 仅用于推导请求上下文中的 i18n，
  // 运行时 Elysia 会按 name 去重，不会重复执行 derive。
  .use(i18nPlugin)
  .use(requestIpPlugin())
  .get(
    '/health',
    {
      detail: {
        operationId: 'health',
        summary: 'System health check',
      },
      response: z.object({
        status: z.literal('ok'),
        startTime: zodDayjs(),
        requestIp: z.string(),
        workId: z.number(),
        hello: z.string(),
      }),
    },
    async ({ requestIp, i18n }) => {
      log.info({ locale: i18n.locale })
      return {
        status: 'ok',
        startTime,
        requestIp,
        workId: snowflake.getWorkerId(),
        hello: i18n.translate('DEMO.HELLO'),
      } as const
    },
  )
