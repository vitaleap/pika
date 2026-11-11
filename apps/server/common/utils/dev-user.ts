import type { JwtPayload } from '@pika/elysia-plugins'
import { config } from '@/common/config'

/**
 * 开发环境虚拟用户：登录时 `username` / `password` 均为 `test` 即返回该身份，便于本地调试。
 */
export const DEV_TEST_USER = {
  sub: '1',
  name: 'test',
  email: 'test@gmail.com',
} as const

/** 判断当前登录用户是否为开发环境虚拟用户（命中时可将 `name` 收窄为非空） */
export const isDevTestUser = (
  user?: Pick<JwtPayload, 'sub' | 'name'>,
): user is { sub: string; name: string } =>
  config.mode === 'development' &&
  user?.sub === DEV_TEST_USER.sub &&
  user?.name === DEV_TEST_USER.name
