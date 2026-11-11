import { cors } from '@elysia/cors'
import { errorPlugin, HttpError } from '@pika/elysia-plugins'
import { describe, expect, test } from 'bun:test'
import { Elysia } from 'elysia'
import { z } from 'zod'
import { i18n, i18nPlugin, t, translateMessage } from '@/common/plugins/i18n'

const errorPluginOpts = {
  translateMessage,
  validationFallbackCode: 'VALIDATION_ERROR',
  validationFallbackMessage: t('COMMON.VALIDATION_ERROR'),
} as const

const app = new Elysia()
  .use(i18nPlugin)
  .use(errorPlugin(errorPluginOpts))
  .get('/error', () => {
    throw new HttpError(t('SYSTEM.USER_NOT_FOUND'), 404)
  })
  .post(
    '/validation',
    {
      body: z.object({
        password: z.string().min(6, t('SYSTEM.PASSWORD_MIN_LENGTH', { min: 6 })),
      }),
    },
    () => 'ok',
  )
  .post(
    '/validation/default',
    {
      body: z.object({
        count: z.number().min(2),
      }),
    },
    () => 'ok',
  )

describe('server i18n', () => {
  test('根据请求语言翻译 HttpError', async () => {
    const response = await app.handle(
      new Request('http://localhost/error', {
        headers: { 'Accept-Language': 'en-US' },
      }),
    )

    expect(response.status).toBe(404)
    expect(response.headers.get('content-language')).toBe('en')
    expect(await response.json()).toMatchObject({
      status: 404,
      code: 'SYSTEM.USER_NOT_FOUND',
      message: 'User not found',
    })
  })

  test('未指定语言时使用默认语言', async () => {
    const response = await app.handle(new Request('http://localhost/error'))

    expect(response.headers.get('content-language')).toBe('zh')
    expect(await response.json()).toMatchObject({
      code: 'SYSTEM.USER_NOT_FOUND',
      message: '用户不存在',
    })
  })

  test('翻译 Zod 校验错误和详情', async () => {
    const response = await app.handle(
      new Request('http://localhost/validation', {
        method: 'POST',
        headers: {
          'Accept-Language': 'en-US',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: '123' }),
      }),
    )

    expect(response.status).toBe(422)
    const payload = await response.json()
    expect(payload).toMatchObject({
      status: 422,
      code: 'SYSTEM.PASSWORD_MIN_LENGTH',
      message: 'Password must be at least 6 characters',
      details: [
        {
          path: 'password',
          code: 'SYSTEM.PASSWORD_MIN_LENGTH',
          message: 'Password must be at least 6 characters',
        },
      ],
    })
    expect(JSON.stringify(payload)).not.toContain('123')
  })

  test('与 CORS 组合时保留 Vary 通配符', async () => {
    const corsApi = new Elysia()
      .use(cors())
      .use(i18nPlugin)
      .get('/', () => 'ok')
    const corsApp = new Elysia().mount('/api', corsApi.fetch)
    const origin = 'https://example.com'
    const response = await corsApp.handle(
      new Request('http://localhost/api/', {
        headers: { 'Accept-Language': 'en', Origin: origin },
      }),
    )

    expect(response.headers.get('access-control-allow-origin')).toBe(origin)
    expect(response.headers.get('content-language')).toBe('en')
    expect(response.headers.get('vary')).toBe('*')

    const preflightResponse = await corsApp.handle(
      new Request('http://localhost/api/resource', {
        method: 'OPTIONS',
        headers: { 'Access-Control-Request-Method': 'POST', Origin: origin },
      }),
    )
    expect(preflightResponse.status).toBe(204)
    expect(preflightResponse.headers.get('access-control-allow-origin')).toBe(origin)
    expect(preflightResponse.headers.get('vary')).toBe('*')
  })

  test('Zod 内置错误使用本地化通用消息', async () => {
    const response = await app.handle(
      new Request('http://localhost/validation/default', {
        method: 'POST',
        headers: {
          'Accept-Language': 'en',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ count: 1 }),
      }),
    )

    expect(response.status).toBe(422)
    expect((await response.json()).message).toBe('Invalid content')
  })
})
const concurrentApp = new Elysia()
  .use(i18nPlugin)
  .use(
    errorPlugin({
      translateMessage,
      validationFallbackCode: 'COMMON.VALIDATION_ERROR',
      validationFallbackMessage: i18n.translate('zh', 'COMMON.VALIDATION_ERROR'),
    }),
  )
  .get('/error/:type', ({ params }) => {
    switch (params.type) {
      case 'user':
        throw new HttpError(t('SYSTEM.USER_NOT_FOUND'), 404)
      case 'auth':
        throw new HttpError(t('COMMON.UNAUTHORIZED'), 401)
      case 'pw-min':
        throw new HttpError(t('SYSTEM.PASSWORD_MIN_LENGTH', { min: 6 }), 400)
      case 'pw-max':
        throw new HttpError(t('SYSTEM.PASSWORD_MAX_LENGTH', { max: 30 }), 400)
      default:
        return { ok: true }
    }
  })
  .post(
    '/validation',
    {
      body: z.object({
        password: z.string().min(6, t('SYSTEM.PASSWORD_MIN_LENGTH', { min: 6 })),
      }),
    },
    () => 'ok',
  )

describe('并发 i18n 隔离', () => {
  test('同一时刻 200 个并发请求中 zh/en 互不串扰', async () => {
    const total = 200
    const tasks: Array<Promise<{ lang: string; code: string; message: string; cl: string }>> = []
    const types = ['user', 'auth', 'pw-min', 'pw-max'] as const

    for (let i = 0; i < total; i++) {
      // 每个 type 都跑一次 zh + en，且交错成 8 个一组，保证所有组合都在并发集里
      const type = types[i % types.length]!
      const lang = Math.floor(i / types.length) % 2 === 0 ? 'zh' : 'en'
      const accept = lang === 'zh' ? 'zh-CN,zh;q=0.9' : 'en-US,en;q=0.9'
      tasks.push(
        concurrentApp
          .handle(
            new Request(`http://localhost/error/${type}`, {
              headers: { 'Accept-Language': accept },
            }),
          )
          .then(async (r) => {
            const body = (await r.json()) as { code: string; message: string }
            return {
              lang,
              code: body.code,
              message: body.message,
              cl: r.headers.get('content-language') ?? '',
            }
          }),
      )
    }

    const results = await Promise.all(tasks)

    // 断言：每条结果的语言和 code/message 完全对应，没有串扰
    for (const r of results) {
      expect(r.cl).toBe(r.lang)
      if (r.lang === 'zh') {
        expect(r.message).toMatch(/[\u4e00-\u9fa5]/) // 必须含中文
      } else {
        expect(r.message).not.toMatch(/[\u4e00-\u9fa5]/) // 必须纯英文
      }
    }

    // 抽样校验具体文案（每种 code 在两种语言下都至少出现一次）
    for (const code of [
      'SYSTEM.USER_NOT_FOUND',
      'COMMON.UNAUTHORIZED',
      'SYSTEM.PASSWORD_MIN_LENGTH',
      'SYSTEM.PASSWORD_MAX_LENGTH',
    ] as const) {
      const zh = results.find((r) => r.lang === 'zh' && r.code === code)!
      const en = results.find((r) => r.lang === 'en' && r.code === code)!
      const expectedZh = {
        'SYSTEM.USER_NOT_FOUND': '用户不存在',
        'COMMON.UNAUTHORIZED': '未授权',
        'SYSTEM.PASSWORD_MIN_LENGTH': '密码不能少于6个字符',
        'SYSTEM.PASSWORD_MAX_LENGTH': '密码不能超过30个字符',
      }[code]
      const expectedEn = {
        'SYSTEM.USER_NOT_FOUND': 'User not found',
        'COMMON.UNAUTHORIZED': 'Unauthorized',
        'SYSTEM.PASSWORD_MIN_LENGTH': 'Password must be at least 6 characters',
        'SYSTEM.PASSWORD_MAX_LENGTH': 'Password must not exceed 30 characters',
      }[code]
      expect(zh.message).toBe(expectedZh)
      expect(en.message).toBe(expectedEn)
    }
  })

  test('Zod 校验错误在并发场景下也按各自请求语言翻译', async () => {
    const total = 100
    const tasks = []
    for (let i = 0; i < total; i++) {
      const lang = i % 2 === 0 ? 'zh' : 'en'
      tasks.push(
        concurrentApp
          .handle(
            new Request('http://localhost/validation', {
              method: 'POST',
              headers: {
                'Accept-Language': lang === 'zh' ? 'zh-CN' : 'en-US',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ password: '123' }),
            }),
          )
          .then(async (r) => {
            const body = (await r.json()) as {
              code: string
              message: string
              details: Array<{ code: string; message: string }>
            }
            return { lang, body, cl: r.headers.get('content-language') ?? '' }
          }),
      )
    }
    const results = await Promise.all(tasks)
    for (const { lang, body, cl } of results) {
      expect(cl).toBe(lang)
      expect(body.code).toBe('SYSTEM.PASSWORD_MIN_LENGTH')
      if (lang === 'zh') {
        expect(body.message).toBe('密码不能少于6个字符')
        expect(body.details[0]!.message).toBe('密码不能少于6个字符')
      } else {
        expect(body.message).toBe('Password must be at least 6 characters')
        expect(body.details[0]!.message).toBe('Password must be at least 6 characters')
      }
    }
  })
})
