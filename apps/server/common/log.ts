import { createLogger } from '@pika/elysia-common'
import { config } from './config'

export const log = createLogger({
  level: config.logLevel,
  mode: config.mode,
  filePath: config.logPath,
})
