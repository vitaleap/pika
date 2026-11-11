declare module 'bun' {
  interface Env {
    /**
     * 端口号，默认 9528
     * @default 9528
     */
    PORT?: string
    /**
     * 日志级别，默认根据环境自动设置，开发环境为debug，生产环境为info
     */
    LOG_LEVEL?: string
    /**
     * 日志文件路径，未配置时仅输出到控制台
     * @example ~/.pika/logs/server.log
     */
    LOG_PATH?: string
    /**
     * 请求超时时间，单位秒，默认120s
     * @default 120
     */
    REQUEST_IDLE_TIMEOUT?: string
    /**
     * 请求体大小，单位字节，默认256MB，即 256 * 1024 * 1024
     * @default 268435456
     */
    REQUEST_MAX_BODY_SIZE?: string

    /**
     * 是否开启多进程模式
     * 仅当生产环境 + PostgreSQL + Redis 缓存 + 该值为 true 时生效
     * @default false
     */
    MULTI_PROCESS_MODE_ENABLED?: string

    /**
     * 允许跨域访问的来源，多个用英文逗号分隔
     * 未配置时，放行所有来源
     * @example https://pika.example.com,https://admin.example.com
     */
    CORS_ORIGINS?: string

    /**
     * 管理员邮箱，与登录用户邮箱完全匹配时授予 admin 角色
     */
    ADMIN_EMAIL?: string

    /**
     * JWT 签发者
     */
    JWT_ISSUER?: string
    /**
     * JWT 密钥
     */
    JWT_SECRET?: string
    /**
     * JWT 过期时间，默认1h
     * @default 1h
     */
    JWT_EXPIRES?: string
    /**
     * JWT 刷新令牌过期时间，默认48h
     * @default 48h
     */
    JWT_REFRESH_EXPIRES?: string

    /**
     * 缓存连接串
     * - redis:// / rediss:// / valkey:// / valkeys:// 等连接串使用 Redis（valkey 与 redis 互通）
     * - memory 使用内存缓存
     * - 其他值视为文件缓存目录
     * - 未配置或留空时使用默认文件缓存目录（开发 .tmp/.cache，生产 ~/.pika/data/.cache）
     * @example redis://localhost:6379/0
     * @example .cache
     * @example memory
     */
    CACHE_URL?: string

    /**
     * 数据库连接串
     * - postgresql:// 使用 PostgreSQL
     * - 其他值视为 PGlite 数据目录
     *   - memory://        内存
     *   - ./pglite.data    文件
     * @example postgresql://user:password@localhost:5432/dbname
     * @example .tmp/.pglite.data
     */
    DATABASE_URL?: string

    /**
     * 文件上传存储目录，未启用 OSS 时使用
     * @example /data/files
     * @example ~/.pika/data/.file
     */
    FILE_PATH?: string

    /**
     * Gravatar 头像服务地址，用于默认头像
     * @default https://gravatar.com
     */
    GAVATAR_BASE_URL?: string

    /**
     * 雪花 ID 机器码位长，取值范围 [1, 15]，且与序列数位长之和不超过 22
     * @default 10
     */
    SNOWFLAKE_WORKER_ID_BIT_LENGTH?: string
    /**
     * 雪花 ID 序列数位长，取值范围 [3, 21]，且与机器码位长之和不超过 22
     * @default 10
     */
    SNOWFLAKE_SEQ_BIT_LENGTH?: string

    /**
     * 是否开启OpenAPI文档，开发环境默认 true，生产环境默认 false
     * @default 开发环境 true，生产环境 false
     */
    OPENAPI_ENABLED?: string
  }
}

/**
 * 配置参数
 */
interface ConfigBase {
  /**
   * 运行模式，默认development
   * @default development
   */
  mode: 'production' | 'development'
  /**
   * 基础路径，固定 /api，无法通过环境变量修改
   * @default /api
   */
  basePath: string
  /**
   * 端口号，默认 9528
   * @default 9528
   */
  port: number
  /**
   * 日志级别，默认根据环境自动设置，开发环境为debug，生产环境为info
   */
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  /**
   * 日志文件路径，未配置时不落盘
   * @example ~/.pika/logs/server.log
   */
  logPath: string
  /**
   * 请求超时时间，单位秒，默认120s
   * @default 120
   */
  requestIdleTimeout: number
  /**
   * 请求体大小，单位字节，默认256MB，即 256 * 1024 * 1024
   * @default 268435456
   */
  requestMaxBodySize: number
  /**
   * 是否开启多进程模式
   * - 仅生产环境 + PostgreSQL + Redis 缓存 + 该值为 true 时生效
   * @default false
   */
  multiProcessModeEnabled: boolean
  /**
   * 允许跨域访问的来源白名单
   * - 未配置时，放行所有来源
   * @example ['https://pika.example.com', 'https://admin.example.com']
   */
  corsOrigins: string[]
  /**
   * 数据库连接字符串
   * - postgresql:// 使用 PostgreSQL
   * - 其他值视为 PGlite 数据目录
   *   - memory://        内存
   *   - ./pglite.data    文件
   * @example postgresql://user:password@localhost:5432/dbname
   * @example .tmp/.pglite.data
   */
  databaseUrl: string

  /**
   * 缓存连接串
   * - redis:// / rediss:// / valkey:// / valkeys:// 等连接串使用 Redis（valkey 与 redis 互通）
   * - memory 使用内存缓存
   * - 其他值视为文件缓存目录
   * - 未配置或留空时使用默认文件缓存目录（开发 .tmp/.cache，生产 ~/.pika/data/.cache）
   * @example redis://localhost:6379/0
   * @example .cache
   * @example memory
   */
  cacheUrl: string

  /**
   * 文件上传存储目录，未启用 OSS 时使用
   * @example /data/files
   * @example ~/.pika/data/.file
   */
  filePath: string

  jwt: {
    /**
     * JWT 签发者
     */
    issuer: string
    /**
     * JWT 密钥
     */
    secret: string
    /**
     * JWT 过期时间，默认1h
     * @default env.JWT_EXPIRES || '1h'
     */
    expires: string
    /**
     * JWT 刷新令牌过期时间，默认48h
     * @default env.JWT_REFRESH_EXPIRES || '48h'
     */
    refreshExpires: string
  }

  openapi: {
    /**
     * 是否开启OpenAPI文档，开发环境默认 true，生产环境默认 false
     * @default 开发环境 true，生产环境 false
     */
    enabled: boolean
  }
}

export interface Config extends ConfigBase {}
