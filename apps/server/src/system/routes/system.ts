import { Elysia } from 'elysia'
import { snowflake } from '@/common/snowflake'
import { zodDayjs } from '@/common/zod'
import { requestIpPlugin } from '@pika/elysia-plugins'
import dayjs from 'dayjs'
import { z } from 'zod'
import { config } from '@/common/config'
import { ConfigService } from '@/system/services/config'
import { auth } from '@/common/plugins/auth'

const startTime = dayjs()

const configSchema = z.object({
  mode: z.enum(['production', 'development']),
  auth: z.object({
    loginTypes: z.array(z.enum(['password', 'phone_code', 'email_code'])),
    regEnabled: z.boolean(),
    regType: z.enum(['email', 'phone']).default('email'),
  }),
})

export const systemRouter = new Elysia({
  detail: {
    tags: ['system'],
    description: '系统相关接口',
  },
})
  .use(
    auth({
      excludePaths: ['/config', '/health'],
    }),
  )
  .get(
    '/config',
    {
      detail: {
        operationId: 'config',
        summary: 'Get system config',
      },
      response: configSchema,
    },
    async () => {
      const dbConfig = await ConfigService.get()
      return configSchema.parse({
        mode: config.mode,
        auth: dbConfig.auth,
      })
    },
  )
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
      }),
    },
    async ({ requestIp }) => {
      return {
        status: 'ok',
        startTime,
        requestIp,
        workId: snowflake.getWorkerId(),
      } as const
    },
  )
