import Elysia from 'elysia'
import { HttpError } from './error'
import { jwtPlugin, type JwtPayload } from './jwt'

export type JwtAuthPluginOpts<
  TRole extends string = string,
  TPermission extends string = string,
> = {
  jwtPlugin: ReturnType<typeof jwtPlugin>
  /** 业务层根据 JWT payload 返回当前用户的角色列表 */
  getRoles?: (user: JwtPayload) => Promise<readonly TRole[]> | readonly TRole[]
  /** 必须包含的角色；不传则不校验角色，传数组时需全部包含 */
  requireRole?: TRole | readonly TRole[]
  /** 业务层根据 JWT payload 返回当前用户的权限列表 */
  getPermissions?: (user: JwtPayload) => Promise<readonly TPermission[]> | readonly TPermission[]
  /** 必须包含的权限；不传则不校验权限，传数组时需全部包含 */
  requirePermissions?: TPermission | readonly TPermission[]
  /** 用于抛出 403 的 i18n token；调用方传入 `() => t('FORBIDDEN')` */
  getForbiddenMessage?: () => string
}

/** 归一化为数组：不传返回空数组，单个字符串包装成单元素数组 */
const toList = <T extends string>(value: T | readonly T[] | undefined): readonly T[] => {
  if (value == null) {
    return []
  }
  return typeof value === 'string' ? [value] : value
}

/**
 * JWT 鉴权插件。
 *
 * - 内部集成 `jwtPlugin` 完成 token 解析，避免调用方重复 use
 * - 通过注入的 `getRoles` 判定当前用户是否拥有 `requireRole`，未传则跳过角色校验
 * - 通过注入的 `getPermissions` 判定当前用户是否拥有 `requirePermissions`，未传则跳过权限校验
 * - 任一校验不通过则抛出 403
 */
export const jwtAuthPlugin = <TRole extends string = string, TPermission extends string = string>(
  opts: JwtAuthPluginOpts<TRole, TPermission>,
) => {
  const forbiddenMessage = opts.getForbiddenMessage ?? (() => 'FORBIDDEN')
  const requireRoles = toList(opts.requireRole)
  const requirePermissions = toList(opts.requirePermissions)
  return new Elysia({ name: 'jwt-auth-plugin' })
    .use(opts.jwtPlugin)
    .onBeforeHandle(async ({ user }) => {
      // 放行路径（includePaths 未命中 / excludePaths 命中）下 jwtPlugin 不会注入 user，
      // 此时鉴权范围已判定为公开，直接跳过角色/权限校验，避免把 undefined 传给
      // getRoles / getPermissions 导致 500
      if (!user) {
        return
      }
      if (requireRoles.length > 0) {
        const roles = (await opts.getRoles?.(user)) ?? []
        if (!requireRoles.every((role) => roles.includes(role))) {
          throw new HttpError(forbiddenMessage(), 403)
        }
      }
      if (requirePermissions.length > 0) {
        const permissions = (await opts.getPermissions?.(user)) ?? []
        if (!requirePermissions.every((permission) => permissions.includes(permission))) {
          throw new HttpError(forbiddenMessage(), 403)
        }
      }
    })
    .as('plugin')
}
