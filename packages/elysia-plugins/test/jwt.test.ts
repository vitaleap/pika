import { describe, expect, test } from 'bun:test'
import { Elysia } from 'elysia'
import { errorPlugin } from '../src/error'
import { createElysiaI18n } from '../src/i18n'
import { jwtPlugin } from '../src/jwt'

const i18n = createElysiaI18n({
  defaultLocale: 'zh',
  messages: {
    AUTH: {
      zh: { UNAUTHORIZED: '未授权', CUSTOM_UNAUTH: '自定义未授权' },
      en: { UNAUTHORIZED: 'Unauthorized', CUSTOM_UNAUTH: 'Custom Unauthorized' },
    },
  },
})
const errorMw = errorPlugin({ translateMessage: i18n.translateMessage })

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

const buildApp = (opts?: Partial<Parameters<typeof jwtPlugin>[0]>) =>
  new Elysia()
    .use(errorMw)
    .use(jwtPlugin({ issuer: ISSUER, secret: SECRET, ...opts }))
    .get('/protected', ({ user }) => ({ sub: user.sub }))
    .get('/public', () => ({ ok: true }))

describe('jwtPlugin', () => {
  test('合法 token 通过校验并暴露 user', async () => {
    const token = await signToken({ sub: 'u1', name: 'alice' })
    const app = buildApp()
    const res = await app.handle(
      new Request('http://localhost/protected', {
        headers: { Authorization: `Bearer ${token}` },
      }),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ sub: 'u1' })
  })

  test('未携带 token 且非忽略路径返回 401', async () => {
    const app = buildApp({ getUnauthorizedMessage: () => i18n.t('AUTH.UNAUTHORIZED') })
    const res = await app.handle(new Request('http://localhost/protected'))
    expect(res.status).toBe(401)
    const body = (await res.json()) as { code?: string; message?: string }
    expect(body.code).toBe('AUTH.UNAUTHORIZED')
    expect(body.message).toBe('未授权')
  })

  test('excludePaths 跳过校验', async () => {
    const app = buildApp({ excludePaths: ['/public'] })
    const res = await app.handle(new Request('http://localhost/public'))
    expect(res.status).toBe(200)
  })

  test('includePaths 白名单：列表内需要 token，列表外放行', async () => {
    const app = buildApp({ includePaths: ['/protected'] })
    // 白名单内：未携带 token 应 401
    const unauth = await app.handle(new Request('http://localhost/protected'))
    expect(unauth.status).toBe(401)
    // 白名单外：未携带 token 放行
    const pub = await app.handle(new Request('http://localhost/public'))
    expect(pub.status).toBe(200)
    // 白名单内：携带 token 通过
    const token = await signToken({ sub: 'u-list' })
    const authed = await app.handle(
      new Request('http://localhost/protected', {
        headers: { Authorization: `Bearer ${token}` },
      }),
    )
    expect(authed.status).toBe(200)
  })

  test('includePaths 优先于 excludePaths', async () => {
    // 两者都配置时仅 includePaths 生效：/public 不在白名单内 → 放行；/protected 在白名单内 → 必须鉴权
    const app = buildApp({ includePaths: ['/protected'], excludePaths: ['/protected'] })
    const res = await app.handle(new Request('http://localhost/protected'))
    expect(res.status).toBe(401)
  })

  test('非法 token 返回 401', async () => {
    const app = buildApp()
    const res = await app.handle(
      new Request('http://localhost/protected', {
        headers: { Authorization: 'Bearer not-a-valid-jwt' },
      }),
    )
    expect(res.status).toBe(401)
  })

  test('query 中的 access_token 同样可被识别', async () => {
    const token = await signToken({ sub: 'u2' })
    const app = buildApp()
    const res = await app.handle(new Request(`http://localhost/protected?access_token=${token}`))
    expect(res.status).toBe(200)
  })

  test('Refresh Token (rfh=true) 作为访问 token 使用时返回 401', async () => {
    const token = await signToken({ sub: 'u3', rfh: true })
    const app = buildApp()
    const res = await app.handle(
      new Request('http://localhost/protected', {
        headers: { Authorization: `Bearer ${token}` },
      }),
    )
    expect(res.status).toBe(401)
  })

  test('getUnauthorizedMessage 自定义 401 文案', async () => {
    const app = buildApp({ getUnauthorizedMessage: () => i18n.t('AUTH.CUSTOM_UNAUTH') })
    const res = await app.handle(new Request('http://localhost/protected'))
    expect(res.status).toBe(401)
    const body = (await res.json()) as { code?: string; message?: string }
    expect(body.code).toBe('AUTH.CUSTOM_UNAUTH')
    expect(body.message).toBe('自定义未授权')
  })

  test('空 secret 抛 Error', () => {
    expect(() => jwtPlugin({ issuer: ISSUER, secret: '' })).toThrow(/secret/)
  })

  test('空 issuer 抛 Error', () => {
    expect(() => jwtPlugin({ issuer: '', secret: SECRET })).toThrow(/issuer/)
  })

  test('自定义 headerTokenType / query 字段', async () => {
    const token = await signToken({ sub: 'u4' })
    const app = new Elysia()
      .use(errorMw)
      .use(
        jwtPlugin({
          issuer: ISSUER,
          secret: SECRET,
          extract: { headerTokenType: 'Token', query: 'tk' },
        }),
      )
      .get('/p', ({ user }) => ({ sub: user.sub }))
    const res = await app.handle(new Request(`http://localhost/p?tk=${token}`))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ sub: 'u4' })
  })
})
