import { describe, expect, test } from 'bun:test'
import { Elysia, status } from 'elysia'
import { errorPlugin, HttpError } from '../src/error'
import { createElysiaI18n } from '../src/i18n'

const i18n = createElysiaI18n({
  defaultLocale: 'zh',
  messages: {
    COMMON: {
      zh: { VALIDATION_ERROR: '内容不合法', NOT_FOUND_USER: '用户不存在' },
      en: { VALIDATION_ERROR: 'Invalid content', NOT_FOUND_USER: 'User not found' },
    },
  },
})

const buildApp = (onUnknownError?: (error: Error, errorId: string) => void) =>
  new Elysia()
    .use(
      errorPlugin({
        translateMessage: i18n.translateMessage,
        validationFallbackMessage: i18n.t('COMMON.VALIDATION_ERROR'),
        onUnknownError,
      }),
    )
    .get('/http-error', () => {
      throw new HttpError(i18n.t('COMMON.NOT_FOUND_USER'), 404)
    })
    .get('/status', () => {
      throw status(401, 'unauthorized by status')
    })
    .post('/json', ({ body }) => body)

describe('errorPlugin', () => {
  test('HttpError 使用自身状态码并翻译 message', async () => {
    const res = await buildApp().handle(new Request('http://localhost/http-error'))
    expect(res.status).toBe(404)
    const body = (await res.json()) as { status: number; code?: string; message?: string }
    expect(body.status).toBe(404)
    expect(body.code).toBe('COMMON.NOT_FOUND_USER')
    expect(body.message).toBe('用户不存在')
  })

  test('throw status(401) 保留状态码，不落入未知错误分支', async () => {
    const res = await buildApp().handle(new Request('http://localhost/status'))
    expect(res.status).toBe(401)
    const body = (await res.json()) as { status: number; message?: string }
    expect(body.status).toBe(401)
    expect(body.message).toBe('unauthorized by status')
  })

  test('主动 throw 的 Response 原样返回，不被包装成错误体', async () => {
    const app = buildApp().get('/response', () => {
      throw new Response('custom body', { status: 404 })
    })
    const res = await app.handle(new Request('http://localhost/response'))
    expect(res.status).toBe(404)
    expect(await res.text()).toBe('custom body')
  })

  test('非法 JSON 请求体返回 400，且不触发 onUnknownError', async () => {
    const unknownErrors: Error[] = []
    const res = await buildApp((error) => unknownErrors.push(error)).handle(
      new Request('http://localhost/json', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{bad json',
      }),
    )
    expect(res.status).toBe(400)
    expect(unknownErrors).toHaveLength(0)
  })

  test('未知错误返回 500、errorId 并触发 onUnknownError', async () => {
    const unknownErrors: Error[] = []
    const app = buildApp((error) => unknownErrors.push(error)).get('/boom', () => {
      throw new Error('boom')
    })
    const res = await app.handle(new Request('http://localhost/boom'))
    expect(res.status).toBe(500)
    const body = (await res.json()) as { status: number; code?: string; errorId?: string }
    expect(body.status).toBe(500)
    expect(body.code).toBe('UNKNOWN')
    expect(body.errorId).toBeTruthy()
    expect(unknownErrors.map((error) => error.message)).toEqual(['boom'])
  })
})
