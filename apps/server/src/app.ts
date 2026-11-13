import { Elysia, file } from 'elysia'
import { cors } from '@elysia/cors'
import {
  gracefulShutdown,
  triggerOnShutdown,
  triggerOnShutdownBefore,
  triggerOnStart,
  triggerOnStartBefore,
} from '@pika/elysia-hook'
import { openapiPlugin } from '@pika/elysia-openapi'
import { errorPlugin, reqIdPlugin, staticPlugin } from '@pika/elysia-plugins'
import { config } from '@/common/config'
import { log } from '@/common/log'
import { snowflake } from '@/common/snowflake'
import { embedPath } from '@/common/utils/embed-assets'
import { globalContextPlugin } from '@/common/plugins/global-context'
import { i18nPlugin, t, translateMessage } from '@/common/plugins/i18n'
import { timezonePlugin } from '@/common/plugins/timezone'
import '@/common/hooks'
import { demoApp } from '@/demo/app'
import { systemApp } from '@/system/app'

export const api = new Elysia({
  serve: {
    idleTimeout: config.requestIdleTimeout,
    maxRequestBodySize: config.requestMaxBodySize,
  },
})
  .use(
    cors({
      // 未配置白名单时, 放行所有来源
      origin: config.corsOrigins.length > 0 ? config.corsOrigins : true,
      credentials: false,
    }),
  )
  .use(
    reqIdPlugin({
      idGenerator: () => snowflake.nextIdSafe(),
    }),
  )
  .use(i18nPlugin)
  .use(
    errorPlugin({
      translateMessage,
      validationFallbackCode: 'VALIDATION_ERROR',
      validationFallbackMessage: t('COMMON.VALIDATION_ERROR'),
      onUnknownError: (error, errorId) => {
        log.error(`[error] ${errorId} ${error.message}`)
        log.error(error)
        log.error(`[error] end`)
      },
    }),
  )
  .use(globalContextPlugin)
  // 依赖 globalContextPlugin 注入的 globalThis.ctx，必须在其之后注册
  .use(timezonePlugin)
  .use(systemApp)
  .use(demoApp)
  .use(
    openapiPlugin({
      basePath: config.basePath,
      enabled: config.openapi.enabled,
      info: {
        title: 'Pika OpenAPI',
        version: '0.1.0',
      },
    }),
  )
  .get('/health', () => ({
    status: 'ok',
  }))

export type Api = typeof api

declare global {
  var __is_hot__: boolean | undefined
}

export const startApp = async (opts?: { port?: number }) => {
  // 本地开发触发 hot 热重载时，手动 shutdown 进行清理
  if (config.mode === 'development' && globalThis.__is_hot__) {
    log.debug('development and is_hot, trigger shutdownBefore and shutdown...')
    await triggerOnShutdownBefore()
    await triggerOnShutdown()
  }

  const basePath = config.basePath
  const port = opts?.port || config.port
  await triggerOnStartBefore()
  const app = new Elysia().mount(basePath, api.fetch)

  if (Bun.env.EMBED_WEB === 'true') {
    app.use(staticPlugin({ root: embedPath('web'), basePath }))
  } else {
    app.get('favicon.ico', file(embedPath('public/logo.svg')))
  }

  app.listen(port, async (server) => {
    log.info(`Elysia is running ${config.mode} at ${server?.url.origin} [pid:${process.pid}]`)
    await triggerOnStart()
    gracefulShutdown(async () => {
      log.info('Gracefully shutdown signal received, stopping server...')
      await triggerOnShutdownBefore()
      await server.stop()
      await triggerOnShutdown()
    })
  })
  globalThis.__is_hot__ = true
  return { app, baseUrl: `http://localhost:${port}${basePath}`, basePath, port }
}
