import { type JwtPayload, type JwtPluginOpts, jwtAuthPlugin, jwtPlugin } from '@pika/elysia-plugins'
import { UserRepository } from '@/system/repositories/user'
import { DEV_TEST_USER, isDevTestUser } from '@/common/utils/dev-user'
import { t } from './i18n'
import { config } from '@/common/config'

export { type JwtPayload, type JwtPluginOpts } from '@pika/elysia-plugins'

/**
 * 扩展 `GlobalContext` 接口，添加 `user: JwtPayload` 字段
 */
declare module '@pika/elysia-plugins' {
  interface GlobalContext {
    user: JwtPayload
  }
}

export type AuthOpts = {
  /** 必须包含的角色；不传则不校验角色，传数组时需全部包含 */
  role?: string | string[]
  /** 必须包含的权限；不传则不校验权限，传数组时需全部包含 */
  permissions?: string | string[]
}

/** 鉴权路径配置，调用方可覆盖默认的白/黑名单 */
type AuthPathOpts = Partial<Pick<JwtPluginOpts, 'basePath' | 'includePaths' | 'excludePaths'>>

/**
 * 根据当前用户邮箱判定角色：与 `ADMIN_EMAIL` 环境变量匹配则为 admin，否则无角色。
 * 每次请求实时查询用户表，保证邮箱变更后权限立即失效。
 */
export const getRoles = async (user: JwtPayload): Promise<string[]> => {
  const email = isDevTestUser(user)
    ? DEV_TEST_USER.email
    : (await UserRepository.findById(user.sub))?.email

  if (email && email === process.env['ADMIN_EMAIL']) {
    return ['admin']
  }
  return []
}

// FIXME 待接入用户权限体系后，改为从 db 查询当前用户的权限
const getPermissions = async (): Promise<string[]> => []

/**
 * 鉴权插件（server 端薄包装）。
 *
 * 基于 `config.jwt` 解析 token 并把 user 写入全局上下文，再按需校验角色与权限；
 * `role` / `permissions` 不传时只做登录校验。
 */
export const auth = ({ role, permissions, ...pathOpts }: AuthOpts & AuthPathOpts = {}) =>
  jwtAuthPlugin({
    jwtPlugin: jwtPlugin({
      issuer: config.jwt.issuer,
      secret: config.jwt.secret,
      prefixPaths: ['/system', '/demo'],
      getUnauthorizedMessage: () => t('COMMON.UNAUTHORIZED'),
      ...pathOpts,
      onBeforeHandle: (user) => {
        // 设置到 ctx 中
        if (user) {
          globalThis.ctx.set('user', user)
        }
      },
    }),
    getRoles,
    requireRole: role,
    getPermissions,
    requirePermissions: permissions,
    getForbiddenMessage: () => t('COMMON.FORBIDDEN'),
  }).as('plugin')
