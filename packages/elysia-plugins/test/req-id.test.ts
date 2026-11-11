import { describe, expect, test } from 'bun:test'
import Elysia from 'elysia'
import { reqIdPlugin } from '../src/req-id'

describe('reqIdPlugin', () => {
  test('响应头与 derive 的 reqId 一致，且忽略客户端伪造的 X-Req-Id', async () => {
    const app = new Elysia().use(reqIdPlugin()).get('/echo', ({ reqId }) => ({ reqId }))

    const res = await app.handle(
      new Request('http://localhost/echo', { headers: { 'X-Req-Id': 'spoofed' } }),
    )
    const data = (await res.json()) as { reqId: string }
    const headerId = res.headers.get('X-Req-Id') ?? ''

    expect(headerId).toBeTruthy()
    expect(headerId).not.toBe('spoofed')
    expect(data.reqId).toBe(headerId)
  })

  test('可注入自定义 idGenerator', async () => {
    const app = new Elysia()
      .use(reqIdPlugin({ idGenerator: () => 'custom-id' }))
      .get('/echo', ({ reqId }) => reqId)

    const res = await app.handle(new Request('http://localhost/echo'))
    expect(await res.text()).toBe('custom-id')
    expect(res.headers.get('X-Req-Id')).toBe('custom-id')
  })

  test('经 mount 转发时，错误响应同样带非空 X-Req-Id 与 X-Res-Time', async () => {
    const inner = new Elysia()
      .use(reqIdPlugin())
      .get('/ok', ({ reqId }) => ({ reqId }))
      .get('/boom', () => {
        throw new Error('boom')
      })
    // mount 会重建 Request 对象，校验 reqId 的 WeakMap 存储前提仍然成立
    const app = new Elysia().mount('/api', inner.fetch)

    const okRes = await app.handle(new Request('http://localhost/api/ok'))
    const okId = okRes.headers.get('X-Req-Id')
    expect(okId).toBeTruthy()
    expect(okRes.headers.get('X-Res-Time')).toBeTruthy()

    const errRes = await app.handle(new Request('http://localhost/api/boom'))
    expect(errRes.status).toBe(500)
    expect(errRes.headers.get('X-Req-Id')).toBeTruthy()
    expect(errRes.headers.get('X-Res-Time')).toBeTruthy()
  })
})
