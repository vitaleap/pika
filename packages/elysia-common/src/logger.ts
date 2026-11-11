import { pino, type Logger } from 'pino'
import { PinoPretty } from 'pino-pretty'
import { resolvePath } from './utils/path'

export interface CreateLoggerOptions {
  /**
   * pino 日志级别，例如 'debug' | 'info' | 'warn' | 'error'
   */
  level: 'debug' | 'info' | 'warn' | 'error'
  /**
   * 运行模式；development 使用同步输出（便于实时查看），production 使用异步输出（性能优先）
   */
  mode: 'production' | 'development'
  /**
   * 日志文件路径；空值或空字符串时仅输出到控制台
   */
  filePath?: string
}

/**
 * 创建 pino + pino-pretty 日志实例。
 *
 * 框架中立，可在任意 Node / Bun 服务中复用。调用方按需传 level / mode。
 *
 * @example
 * ```ts
 * const log = createLogger({ level: 'debug', mode: 'development' })
 * log.info('hello')
 *
 * // 同时写入文件
 * const fileLog = createLogger({
 *   level: 'info',
 *   mode: 'production',
 *   filePath: '~/.pika/logs/server.log',
 * })
 * ```
 */

export const createLogger = ({ level, mode, filePath }: CreateLoggerOptions): Logger => {
  // 路径类配置统一展开 ~ 并转为绝对路径；空值或空字符串表示仅输出到控制台
  const destination = filePath ? resolvePath(filePath) : undefined
  return pino(
    {
      level,
    },
    PinoPretty({
      // 开发环境启用同步日志，生产环境异步日志
      sync: mode === 'development',
      colorize: true,
      singleLine: true,
      levelFirst: true,
      translateTime: 'SYS:yyyy/mm/dd HH:MM:ss',
      ignore: process.env['MULTI_PROCESS_MODE_ENABLED'] === 'true' ? 'hostname' : 'pid,hostname',
      destination,
      mkdir: destination !== undefined,
    }),
  )
}
