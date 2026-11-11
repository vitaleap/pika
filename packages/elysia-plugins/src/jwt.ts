import { jwt } from '@elysia/jwt'
import Elysia from 'elysia'
import { z } from 'zod'
import { HttpError } from './error'

// 额外属性的允许值类型，对齐原 TypeBox 中
// t.Record(t.String(), t.Union([...])) 的语义
//
// 注意：不加 z.undefined()，因为 JSON Schema 不支持 undefined，
// elysia-openapi 生成 OpenAPI 文档时会对 schema 调用 z.toJSONSchema()，
// 加了会导致启动报 “Undefined cannot be represented in JSON Schema”。
// 因此对于额外属性的 `undefined` 值，需由调用方通过条件展开避免传入。
const JwtPayloadExtraValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.union([z.string(), z.number(), z.boolean()])),
])

export const JwtPayloadSchema = z
  .object({
    sub: z.string().describe('Subject，一般表示用户 ID'),
    name: z.string().optional().describe('名称，例如姓名全称或用户名'),
    nickname: z.string().optional().describe('昵称'),
    picture: z.string().optional().describe('头像 URL 地址'),
    address: z.string().optional().describe('地址'),
    gender: z.string().optional().describe('性别'),
    email: z.string().optional().describe('邮箱'),
    email_verified: z.boolean().optional().describe('邮箱是否已验证'),
    phone_number: z.string().optional().describe('手机号'),
    phone_number_verified: z.boolean().optional().describe('手机号是否已验证'),
    roles: z.array(z.string()).optional().describe('角色列表'),
    rfh: z.boolean().optional().describe('是否为 Refresh Token'),
    iss: z.string().optional().describe('Issuer，令牌颁发者'),
    iat: z.number().optional().describe('Issued At，签发时间戳'),
    exp: z.number().optional().describe('Expiration Time，过期时间戳'),
    aud: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .describe('Audience，令牌接收方'),
    nbf: z.number().optional().describe('Not Before，在此时间之前无效'),
    jti: z.string().optional().describe('JWT ID，令牌唯一标识，可用于防止重放'),
    nonce: z.string().optional().describe('随机且不重复的字符串，可用于 OIDC 模式'),
  })
  // 允许额外属性，值类型受 JwtPayloadExtraValueSchema 约束
  // 对应原 TypeBox 中 t.Instantiate 的第二个参数（额外的 Record 约束）
  .catchall(JwtPayloadExtraValueSchema)

/**
 * JwtPayload
 *
 * @see {@link https://www.rfc-editor.org/rfc/rfc7519#section-4.1 RFC7519#section-4.1}
 */
export type JwtPayload = z.infer<typeof JwtPayloadSchema>

export type JwtPluginOpts = {
  /** Issuer，令牌颁发者，必填 */
  issuer: string
  /** 签名密钥，必填 */
  secret: string
  /**
   * 前缀路径，例如 ['/system','/demo']
   * 当不为空，请求的接口必须符合前缀，否则直接401
   */
  prefixPaths?: string[]
  /**
   * 基础路径，例如用在 userRouter 上，basePath 设为 /user ，则 includePaths/excludePaths 可以简写为 ['/userinfo','/edit']
   */
  basePath?: string
  /**
   * 包含路径：需要鉴权的路径
   *
   * 当不为空时，仅校验列表内的路径，其他路径直接放行（与 `excludePaths` 互斥，优先级更高）。
   * 路径会先经 `prefixPaths` / `basePath` 处理再匹配。
   */
  includePaths?: string[]
  /**
   * 排除路径：不需要鉴权的路径
   *
   * 仅在 `includePaths` 为空时生效；其他路径都会强制要求 token。
   */
  excludePaths?: string[]

  /** token 提取方式，默认 `Authorization: Bearer <token>` 或 query `?access_token=` */
  extract?: {
    query?: string
    headerTokenType?: string
  }
  /** 用于抛出 401 的 i18n token；调用方传入 `() => t('UNAUTHORIZED')` */
  getUnauthorizedMessage?: () => string

  /**
   * 在 token 解析（`derive`）之后、路由 handler 之前执行的钩子。
   *
   * 命中 `includePaths` / `excludePaths` 而无需鉴权的路径不会注入 `user`，
   * 因此 `user` 可能为 `undefined`，使用前需自行判空。
   *
   * @param user 当前登录者信息；未登录或命中放行路径时为 `undefined`
   */
  onBeforeHandle?: (user?: JwtPayload) => void | Promise<void>
}

/**
 * JWT 鉴权插件。
 *
 * - 注册 `@elysia/jwt` 并提供 `jwt.sign/verify`
 * - 从 `Authorization` 头（默认 Bearer）或 query 中提取 token
 * - 解析成功后将 `user` 挂载到请求上下文
 * - 鉴权范围由 `includePaths`（白名单）/ `excludePaths`（黑名单）控制；都为空则全量校验
 * - 拒绝 Refresh Token（`rfh === true`）作为访问 token 使用
 */
export const jwtPlugin = (opts: JwtPluginOpts) => {
  if (opts.secret.length <= 0) {
    throw new Error(`jwt secret can't be empty`)
  }
  if (opts.issuer.length <= 0) {
    throw new Error(`jwt issuer can't be empty`)
  }
  const extract = {
    headerTokenType: 'Bearer',
    query: 'access_token',
    ...opts.extract,
  }
  const includePaths = opts.includePaths ?? []
  const excludePaths = opts.excludePaths ?? []
  const unauthorizedMessage = opts.getUnauthorizedMessage ?? (() => 'UNAUTHORIZED')
  return new Elysia({ name: 'jwt-plugin' })
    .use(
      jwt({
        name: 'jwt',
        iss: opts.issuer,
        secret: opts.secret,
        schema: JwtPayloadSchema,
      }),
    )
    .derive(async ({ path, jwt, query, headers: { authorization } }) => {
      let currentPath
      if (opts.prefixPaths && opts.prefixPaths.length > 0) {
        const prefix = opts.prefixPaths.find((item) => path.startsWith(item))
        if (!prefix) {
          throw new HttpError(unauthorizedMessage(), 401)
        }
        currentPath = path.substring(prefix.length)
      } else {
        currentPath = path
      }
      if (opts.basePath) {
        currentPath = currentPath.substring(opts.basePath.length)
      }
      let token: string | undefined
      if (authorization?.startsWith(extract.headerTokenType)) {
        token = authorization.slice(extract.headerTokenType.length + 1)
      } else {
        token = query[extract.query]
      }
      let user: JwtPayload | undefined
      if (token) {
        try {
          const payload = await jwt.verify(token)
          if (typeof payload === 'object' && payload !== null) {
            user = payload
          }
        } catch {}
      }
      if (user?.rfh === true) {
        throw new HttpError(unauthorizedMessage(), 401)
      }
      if (!user) {
        // 鉴权范围：
        // - includePaths 非空 → 白名单，仅列表内需要鉴权
        // - includePaths 为空 + excludePaths 非空 → 黑名单，列表内跳过
        // - 两者皆空 → 默认全量鉴权
        let requireAuth = true
        if (includePaths.length > 0) {
          requireAuth = includePaths.some((p) => currentPath === p)
        } else if (excludePaths.length > 0) {
          requireAuth = !excludePaths.some((p) => currentPath === p)
        }
        if (requireAuth) {
          throw new HttpError(unauthorizedMessage(), 401)
        }
      }
      return {
        get user(): JwtPayload {
          return user!
        },
      }
    })
    .onBeforeHandle(async ({ user }) => {
      await opts.onBeforeHandle?.(user)
    })
    .as('plugin')
}
