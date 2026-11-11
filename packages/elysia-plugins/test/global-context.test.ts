import { describe, expect, test } from 'bun:test'
import Elysia from 'elysia'
import { createGlobalContextPlugin, type GlobalContext } from '../src/global-context'

/**
 * 构造一个最小 GlobalContext，供 `ctx.run` 注入使用。
 * 多个手动注入 Context 的测试共用此 factory。
 */
const fakeContext = (url = 'http://localhost/test') =>
  ({ request: { url, method: 'GET', headers: {} } }) as GlobalContext

describe('createGlobalContextPlugin', () => {
  test('service 层可通过 ctx.get() 访问当前 Context', async () => {
    const { ctx, plugin } = createGlobalContextPlugin()
    const app = new Elysia().use(plugin).get('/echo', () => {
      return ctx.get('request').url
    })

    const res = await app.handle(new Request('http://localhost/echo'))
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('http://localhost/echo')
  })

  test('获取请求头', async () => {
    const { ctx, plugin } = createGlobalContextPlugin()
    const app = new Elysia().use(plugin).get('/echo', () => {
      return ctx.get('request').headers['authorization']
    })

    const res = await app.handle(
      new Request('http://localhost/echo', {
        headers: {
          authorization: '123',
        },
      }),
    )

    expect(res.status).toBe(200)
    expect(await res.text()).toBe('123')
  })

  test('onBeforeHandle 中也能获取 Context', async () => {
    const { ctx, plugin } = createGlobalContextPlugin()
    const app = new Elysia()
      .use(plugin)
      .onBeforeHandle(({ set }) => {
        // 验证 onBeforeHandle 内能读取 ctx
        set.headers['x-url'] = ctx.get('request').url
      })
      .get('/before', () => 'ok')

    const res = await app.handle(new Request('http://localhost/before'))
    expect(res.status).toBe(200)
    expect(res.headers.get('x-url')).toBe('http://localhost/before')
  })

  test('并发请求中 service 层能拿到各自请求的 context', async () => {
    const { ctx, plugin } = createGlobalContextPlugin()
    const app = new Elysia().use(plugin).get('/echo/:msg', async ({ params }) => {
      // 模拟 service 层异步操作后读取 ctx
      await new Promise((r) => setTimeout(r, Math.random() * 10))
      const ctxMsg = ctx.get('request').url.substring('http://localhost/echo/'.length)
      return `${params.msg}|${ctxMsg}`
    })

    const responses = await Promise.all(
      ['a', 'b', 'c', 'd', 'e'].map((m) =>
        app.handle(new Request(`http://localhost/echo/${m}`)).then((r) => r.text()),
      ),
    )
    // 每个请求的 service 层 ctx.get() 必须与自己请求的 params.msg 一致
    expect(responses.sort()).toEqual(['a|a', 'b|b', 'c|c', 'd|d', 'e|e'])
  })

  test('请求外（在创建 storage 之前）调用 ctx.get() 抛出 Error', () => {
    const { ctx } = createGlobalContextPlugin()
    expect(() => ctx.get('request')).toThrow(/not found context/)
  })

  test('ctx.run(store, callback) 可手动注入 Context', () => {
    const { ctx } = createGlobalContextPlugin()
    const result = ctx.run(
      fakeContext('http://localhost/test/callback'),
      () => ctx.get('request').url,
    )
    expect(result).toBe('http://localhost/test/callback')
  })

  test('ctx.run 结束后自动清理，外部 ctx.get 抛错', () => {
    const { ctx } = createGlobalContextPlugin()

    ctx.run(fakeContext(), () => {
      // run 内部能访问
      expect(() => ctx.get('request')).not.toThrow()
    })

    // run 结束后外部访问应抛错
    expect(() => ctx.get('request')).toThrow(/not found context/)
  })

  test('ctx.run 支持异步回调，await 之后仍可访问 Context', async () => {
    const { ctx } = createGlobalContextPlugin()
    const result = await ctx.run(fakeContext('http://localhost/test/async'), async () => {
      await Bun.sleep(1)
      return ctx.safeGet('request')
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.url).toBe('http://localhost/test/async')
    }

    // Promise 结束后同样需要清理
    expect(() => ctx.get('request')).toThrow(/not found context/)
  })

  test('扩展 Context', async () => {
    const { ctx, plugin } = createGlobalContextPlugin((context) => {
      return {
        params: context.params,
      }
    })
    const app = new Elysia().use(plugin).get('/:id', () => {
      return `id:${(ctx.get('params') as Record<string, string>).id}`
    })

    const res = await app.handle(new Request('http://localhost/a'))
    expect(await res.text()).toBe(`id:a`)
  })

  test('复杂场景', async () => {
    const { ctx, plugin } = createGlobalContextPlugin((context) => {
      return {
        userId: context.params['id'] || '',
      }
    })
    const app = new Elysia().use(plugin).get('/:id', ({ params }) => {
      if (params.id === 'a') {
        return {
          paramsId: params.id,
          ctxId: ctx.get('userId'),
        }
      }
      return ctx.run(
        {
          ...ctx.getAll(),
          userId: 'notA',
        },
        () => {
          return {
            paramsId: params.id,
            ctxId: ctx.get('userId'),
          }
        },
      )
    })

    const resA = await app.handle(new Request('http://localhost/a'))
    const dataA = await resA.json()
    expect(dataA.ctxId).toBe('a')

    const resB = await app.handle(new Request('http://localhost/b'))
    const dataB = await resB.json()
    expect(dataB.ctxId).toBe('notA')
  })

  test('直接赋值', async () => {
    const { ctx, plugin } = createGlobalContextPlugin(() => {
      return {
        user: { id: '' },
      }
    })
    const app = new Elysia()
      .use(plugin)
      .onBeforeHandle(() => {
        ctx.set('user', { id: '0' })
      })
      .get('/userinfo', () => {
        return `id:${ctx.get('user').id}`
      })

    const res = await app.handle(new Request('http://localhost/userinfo'))
    expect(await res.text()).toBe(`id:0`)
  })

  // ---------- 新 API 用例 ----------

  test('ctx.set(key, val) 设置当前 Context 的值，并支持链式调用', async () => {
    const { ctx, plugin } = createGlobalContextPlugin<{ user?: { id: string } }>()
    const app = new Elysia().use(plugin).get('/test', () => {
      // 链式：set 返回 ctx，再 .get 取值
      const id = ctx.set('user', { id: '42' }).get('user')!.id
      return id
    })

    const res = await app.handle(new Request('http://localhost/test'))
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('42')
  })

  test('ctx.set(key, val) 在请求外抛错', () => {
    const { ctx } = createGlobalContextPlugin<{ user?: { id: string } }>()
    expect(() => ctx.set('user', { id: '1' })).toThrow(/not found context/)
  })

  test('ctx.set 后 handler 中 ctx.get 能读到最新值', async () => {
    const { ctx, plugin } = createGlobalContextPlugin<{ count?: number }>()
    const app = new Elysia().use(plugin).get('/test', () => {
      ctx.set('count', 1)
      ctx.set('count', 2)
      return String(ctx.get('count'))
    })

    const res = await app.handle(new Request('http://localhost/test'))
    expect(await res.text()).toBe('2')
  })

  test('ctx.safeGet(key) 成功时返回单个值，失败时返回 error', () => {
    const { ctx } = createGlobalContextPlugin()

    // 请求外
    const fail = ctx.safeGet('request')
    expect(fail.success).toBe(false)
    if (!fail.success) {
      expect(fail.error).toMatch(/not found context/)
    }

    // 请求内（手动注入）
    const ok = ctx.run(fakeContext('http://localhost/x'), () => ctx.safeGet('request'))
    expect(ok.success).toBe(true)
    if (ok.success) {
      expect(ok.data.url).toBe('http://localhost/x')
    }
  })

  test('ctx.safeGet(key) 在请求内可直接读取 request 子树', async () => {
    const { ctx, plugin } = createGlobalContextPlugin()
    const app = new Elysia().use(plugin).get('/echo', () => {
      const result = ctx.safeGet('request')
      if (!result.success) return 'fail'
      // safeGet('request') 返回的是 request 子树本身
      return result.data.url
    })

    const res = await app.handle(new Request('http://localhost/echo'))
    expect(await res.text()).toBe('http://localhost/echo')
  })

  test('ctx.set(key, val) 拒绝 null / undefined', () => {
    const { ctx } = createGlobalContextPlugin<{ user?: { id: string } | null }>()
    const store = fakeContext('http://localhost/x')

    expect(() => ctx.run(store, () => ctx.set('user', null))).toThrow(
      /Cannot set undefined or null/,
    )
    expect(() => ctx.run(store, () => ctx.set('user', undefined))).toThrow(
      /Cannot set undefined or null/,
    )
  })

  test('ctx.safeGet(key) 对未注入的 key 返回 success: false', async () => {
    const { ctx, plugin } = createGlobalContextPlugin<{ user?: { id: string } }>()
    const app = new Elysia().use(plugin).get('/safe-get', () => {
      const result = ctx.safeGet('user')
      return result.success ? 'success' : result.error
    })

    const res = await app.handle(new Request('http://localhost/safe-get'))
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('user is not injected')
  })

  test('ctx.getAll() 返回当前整个 Context', async () => {
    const { ctx, plugin } = createGlobalContextPlugin((context) => ({
      userId: context.params['id'] ?? '',
    }))
    const app = new Elysia().use(plugin).get('/:id', () => {
      const all = ctx.getAll()
      return { url: all.request.url, userId: all.userId }
    })

    const res = await app.handle(new Request('http://localhost/abc'))
    expect(await res.json()).toEqual({
      url: 'http://localhost/abc',
      userId: 'abc',
    })
  })

  test('ctx.getAll() 在请求外抛错', () => {
    const { ctx } = createGlobalContextPlugin()
    expect(() => ctx.getAll()).toThrow(/not found context/)
  })

  test('基于 ctx.getAll() 复制并覆盖字段后 ctx.run', async () => {
    const { ctx, plugin } = createGlobalContextPlugin((context) => ({
      userId: context.params['id'] ?? '',
    }))
    const app = new Elysia().use(plugin).get('/:id', ({ params }) => {
      // 通过 getAll 复制整个 context，覆写 userId 后 run
      const overridden = ctx.run({ ...ctx.getAll(), userId: `override:${params.id}` }, () =>
        ctx.get('userId'),
      )
      return overridden
    })

    const res = await app.handle(new Request('http://localhost/abc'))
    expect(await res.text()).toBe('override:abc')
  })

  test('ctx.safeGetAll() 返回当前整个 Context 或 error', () => {
    const { ctx } = createGlobalContextPlugin()

    // 请求外
    const fail = ctx.safeGetAll()
    expect(fail.success).toBe(false)
    if (!fail.success) {
      expect(fail.error).toMatch(/not found context/)
    }

    // 请求内（手动注入）
    const ok = ctx.run(fakeContext('http://localhost/x'), () => ctx.safeGetAll())
    expect(ok.success).toBe(true)
    if (ok.success) {
      expect(ok.data.request.url).toBe('http://localhost/x')
    }
  })

  test('ctx.safeGetAll() 在请求内可读到 CustomContext 字段', async () => {
    const { ctx, plugin } = createGlobalContextPlugin<{ traceId?: string }>(() => ({
      traceId: 'trace-xyz',
    }))
    const app = new Elysia().use(plugin).get('/echo', () => {
      const result = ctx.safeGetAll()
      if (!result.success) return 'fail'
      return `${result.data.request.url}#${result.data.traceId}`
    })

    const res = await app.handle(new Request('http://localhost/echo'))
    expect(await res.text()).toBe('http://localhost/echo#trace-xyz')
  })
})
