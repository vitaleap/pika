import { describe, expect, test } from 'bun:test'
import { Elysia } from 'elysia'
import { jwtAuthPlugin } from '../src/jwt-auth'
import { jwtPlugin, type JwtPayload } from '../src/jwt'

const SECRET = 'test-secret-32-chars-long-enoughxx'
const ISSUER = 'test-issuer'

type SignFn = (payload: object) => Promise<string>

/**
 * 通过专用 sign 端点触发 jwt.sign，便于在测试中获取合法 token。
 */
const signToken = async (payload: object): Promise<string> => {
  const app = new Elysia()
    .use(jwtPlugin({ issuer: ISSUER, secret: SECRET, excludePaths: ['/sign'] }))
    .post('/sign', ({ jwt }) => (jwt.sign as SignFn)(payload))
  const res = await app.handle(new Request('http://localhost/sign', { method: 'POST' }))
  return await res.text()
}

type JwtAuthOpts = Parameters<typeof jwtAuthPlugin>[0]

const buildApp = (opts: Partial<JwtAuthOpts> = {}) =>
  new Elysia()
    .use(
      jwtAuthPlugin({
        jwtPlugin: jwtPlugin({ issuer: ISSUER, secret: SECRET }),
        ...opts,
      }),
    )
    .get('/admin', () => ({ ok: true }))

const request = (token: string) =>
  new Request('http://localhost/admin', {
    headers: { Authorization: `Bearer ${token}` },
  })

describe('jwtAuthPlugin', () => {
  test('当前用户角色包含 requireRole 时放行', async () => {
    const token = await signToken({ sub: 'u1', email: 'admin@example.com' })
    const app = buildApp({
      getRoles: (user) => (user.email === 'admin@example.com' ? (['admin'] as const) : []),
      requireRole: 'admin',
    })
    const res = await app.handle(request(token))
    expect(res.status).toBe(200)
  })

  test('当前用户角色不包含 requireRole 时返回 403', async () => {
    const token = await signToken({ sub: 'u2', email: 'user@example.com' })
    const app = buildApp({
      getRoles: () => [],
      requireRole: 'admin',
    })
    const res = await app.handle(request(token))
    expect(res.status).toBe(403)
  })

  test('未传 requireRole 时不校验角色', async () => {
    const token = await signToken({ sub: 'u3' })
    const app = buildApp({
      getRoles: () => [],
    })
    const res = await app.handle(request(token))
    expect(res.status).toBe(200)
  })

  test('payload 不含 email 时按未匹配处理', async () => {
    const token = await signToken({ sub: 'u4' })
    const app = buildApp({
      getRoles: (user) => (user.email ? (['admin'] as const) : []),
      requireRole: 'admin',
    })
    const res = await app.handle(request(token))
    expect(res.status).toBe(403)
  })

  test('getForbiddenMessage 自定义 403 文案', async () => {
    const token = await signToken({ sub: 'u5' })
    const app = buildApp({
      getRoles: () => [],
      requireRole: 'admin',
      getForbiddenMessage: () => 'CUSTOM_FORBIDDEN',
    })
    const res = await app.handle(request(token))
    expect(res.status).toBe(403)
    expect(await res.text()).toBe('CUSTOM_FORBIDDEN')
  })

  test('自定义 requireRole 支持泛型字符串', async () => {
    const token = await signToken({ sub: 'u6', email: 'manager@example.com' })
    const app = buildApp({
      getRoles: (user): readonly 'manager'[] =>
        user.email === 'manager@example.com' ? ['manager'] : [],
      requireRole: 'manager',
    })
    const res = await app.handle(request(token))
    expect(res.status).toBe(200)
  })

  test('getRoles 可直接消费 JwtPayload', async () => {
    const token = await signToken({ sub: 'payload-id', name: 'alice' })
    let received: JwtPayload | undefined
    const app = buildApp({
      getRoles: (user) => {
        received = user
        return user.sub === 'payload-id' ? (['admin'] as const) : []
      },
      requireRole: 'admin',
    })
    const res = await app.handle(request(token))
    expect(res.status).toBe(200)
    expect(received?.sub).toBe('payload-id')
    expect(received?.name).toBe('alice')
  })

  test('当前用户拥有全部 requirePermissions 时放行', async () => {
    const token = await signToken({ sub: 'u7' })
    const app = buildApp({
      getPermissions: () => ['user:read', 'user:write'],
      requirePermissions: ['user:read', 'user:write'],
    })
    const res = await app.handle(request(token))
    expect(res.status).toBe(200)
  })

  test('requirePermissions 传单个字符串时放行', async () => {
    const token = await signToken({ sub: 'u11' })
    const app = buildApp({
      getPermissions: () => ['user:read'],
      requirePermissions: 'user:read',
    })
    const res = await app.handle(request(token))
    expect(res.status).toBe(200)
  })

  test('requireRole 传数组时需全部包含', async () => {
    const token = await signToken({ sub: 'u12' })
    const app = buildApp({
      getRoles: () => ['admin', 'editor'],
      requireRole: ['admin', 'editor'],
    })
    expect((await app.handle(request(token))).status).toBe(200)

    const partialApp = buildApp({
      getRoles: () => ['admin'],
      requireRole: ['admin', 'editor'],
    })
    expect((await partialApp.handle(request(token))).status).toBe(403)
  })

  test('当前用户缺少任一 requirePermissions 时返回 403', async () => {
    const token = await signToken({ sub: 'u8' })
    const app = buildApp({
      getPermissions: () => ['user:read'],
      requirePermissions: ['user:read', 'user:write'],
    })
    const res = await app.handle(request(token))
    expect(res.status).toBe(403)
  })

  test('未传 requirePermissions 时不校验权限', async () => {
    const token = await signToken({ sub: 'u9' })
    const app = buildApp({
      getPermissions: () => [],
    })
    const res = await app.handle(request(token))
    expect(res.status).toBe(200)
  })

  test('角色与权限同时校验', async () => {
    const token = await signToken({ sub: 'u10' })
    const app = buildApp({
      getRoles: () => ['admin'],
      requireRole: 'admin',
      getPermissions: () => ['user:read'],
      requirePermissions: ['user:write'],
    })
    const res = await app.handle(request(token))
    expect(res.status).toBe(403)
  })

  test('放行路径不注入 user 时跳过角色/权限校验', async () => {
    // 模拟业务实现：直接读取 user.sub，user 为空即抛错
    const getRoles = (user: JwtPayload) => (user.sub === 'u13' ? ['admin'] : [])
    const getPermissions = (user: JwtPayload) => (user.sub === 'u13' ? ['user:read'] : [])
    const app = new Elysia()
      .use(
        jwtAuthPlugin({
          jwtPlugin: jwtPlugin({
            issuer: ISSUER,
            secret: SECRET,
            excludePaths: ['/public'],
          }),
          getRoles,
          requireRole: 'admin',
          getPermissions,
          requirePermissions: 'user:read',
        }),
      )
      .get('/public', () => ({ ok: true }))

    const res = await app.handle(new Request('http://localhost/public'))
    expect(res.status).toBe(200)
  })

  test('includePaths 未命中的路径同样跳过角色校验', async () => {
    const app = new Elysia()
      .use(
        jwtAuthPlugin({
          jwtPlugin: jwtPlugin({
            issuer: ISSUER,
            secret: SECRET,
            includePaths: ['/admin'],
          }),
          getRoles: (user) => (user.sub === 'u14' ? ['admin'] : []),
          requireRole: 'admin',
        }),
      )
      .get('/public', () => ({ ok: true }))

    const res = await app.handle(new Request('http://localhost/public'))
    expect(res.status).toBe(200)
  })
})
