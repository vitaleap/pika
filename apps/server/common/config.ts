import type { Config } from './config-type'
import { joinHomePath } from './utils/home'

const mode = Bun.env.NODE_ENV === 'production' ? 'production' : 'development'

const parseLevel = <T extends string>(
  level: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T => {
  const normalized = level?.toLowerCase()
  return allowed.includes(normalized as T) ? (normalized as T) : fallback
}

const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const

const env = Bun.env

// 生产环境缺少密钥时直接拒绝启动，避免用空密钥签发可被伪造的 token
const jwtSecret =
  env['JWT_SECRET']?.trim() || (mode === 'development' ? '928bb669f3694e9ab6b79db88dd1a6a9' : '')
if (!jwtSecret || jwtSecret === '?') {
  throw new Error(
    '[config] 生产环境必须设置 JWT_SECRET 环境变量（可用 `openssl rand -hex 32` 生成），否则任何人都能伪造登录令牌',
  )
}

// 多因素验证密钥：显式配置时不允许保留 `?` 占位值，否则所有部署共用同一密钥加密 TOTP 密钥
const multiFactorSecret = env['MULTI_FACTOR_SECRET']?.trim()
if (multiFactorSecret === '?') {
  throw new Error(
    '[config] MULTI_FACTOR_SECRET 不能使用占位值 `?`（可用 `openssl rand -hex 32` 生成），或删除该变量以回退到 JWT_SECRET',
  )
}

/**
 * 缺省配置值
 */
const defaultConfig = {
  port: 9528,
  logLevel: mode === 'production' ? 'info' : 'debug',
  logPath: '',
  requestIdleTimeout: 120,
  requestMaxBodySize: 256 * 1024 * 1024,
  databaseUrl: mode === 'development' ? 'memory' : joinHomePath('data', '.pglite.data'),
  cacheUrl: mode === 'development' ? 'memory' : joinHomePath('data', '.cache'),
  filePath: mode === 'development' ? '.tmp/.file' : joinHomePath('data', '.file'),
  jwt: {
    issuer: 'pika',
    expires: '1h',
    refreshExpires: '48h',
  },
} as Config

export const config: Config = {
  mode,
  basePath: '/api',
  port: Number(env['PORT']) || defaultConfig.port,
  logLevel: parseLevel(env['LOG_LEVEL'], LOG_LEVELS, defaultConfig.logLevel),
  logPath: env['LOG_PATH'] || defaultConfig.logPath,
  requestIdleTimeout: Number(env['REQUEST_IDLE_TIMEOUT']) || defaultConfig.requestIdleTimeout,
  requestMaxBodySize: Number(env['REQUEST_MAX_BODY_SIZE']) || defaultConfig.requestMaxBodySize,
  multiProcessModeEnabled: env['MULTI_PROCESS_MODE_ENABLED'] === 'true',
  corsOrigins: (env['CORS_ORIGINS'] ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  databaseUrl: env['DATABASE_URL'] || defaultConfig.databaseUrl,
  cacheUrl: env['CACHE_URL'] || defaultConfig.cacheUrl,
  filePath: env['FILE_PATH'] || defaultConfig.filePath,
  multiFactor: {
    // 未单独配置时复用 JWT 密钥，避免新增功能导致已有部署启动失败
    secret: multiFactorSecret || jwtSecret,
  },
  jwt: {
    secret: jwtSecret,
    issuer: env['JWT_ISSUER'] || defaultConfig.jwt.issuer,
    expires: env['JWT_EXPIRES'] || defaultConfig.jwt.expires,
    refreshExpires: env['JWT_REFRESH_EXPIRES'] || defaultConfig.jwt.refreshExpires,
  },
  openapi: {
    enabled:
      mode === 'production'
        ? env['OPENAPI_ENABLED'] === 'true'
        : env['OPENAPI_ENABLED'] !== 'false',
  },
}
