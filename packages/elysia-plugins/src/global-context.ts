import { AsyncLocalStorage } from 'node:async_hooks'
import Elysia, { type Context as ElysiaContext, type HTTPHeaders } from 'elysia'

/**
 * Interface for context variable mapping.
 * @example
 * ```ts
 * // 可以通过此方法扩展属性
 * declare module '@pika/elysia-plugins' {
 *  interface GlobalContext {
 *    user: JwtPayload
 *  }
 * }
 * ```
 */
export interface GlobalContext {
  request: {
    url: string
    path: string
    method: string
    headers: HTTPHeaders
  }
}

/**
 * 类似 Java ThreadLocal 的全局上下文引用。
 * 仅在请求生命周期内有效，跨请求不可用。
 */
export type GlobalCtx<C extends Record<string, any> = {}> = {
  /**
   * 获取当前请求的 Context 中指定 key 的值。
   *
   * @throws 当不在请求生命周期内也未通过 `ctx.run` 注入 Context 时抛出 Error。
   */
  get: <K extends keyof (GlobalContext & C)>(key: K) => (GlobalContext & C)[K]
  /**
   * 获取当前请求的整个 Context。
   * 适用于需要基于当前 Context 复制并修改个别字段后再 `ctx.run` 的场景。
   *
   * @throws 当不在请求生命周期内也未通过 `ctx.run` 注入 Context 时抛出 Error。
   */
  getAll: () => GlobalContext & C
  /**
   * 设置当前 Context 中指定 key 的值。
   *
   * @returns ctx 自身，用于链式调用。
   * @throws 当不在请求生命周期内时抛出 Error。
   */
  set: <K extends keyof (GlobalContext & C)>(key: K, val: (GlobalContext & C)[K]) => GlobalCtx<C>
  /**
   * 安全获取当前 Context 中指定 key 的值。
   *
   * 当 key 未注入（不存在或值为 `null` / `undefined`）或不在请求生命周期内时，
   * 返回 `{ success: false, error }` 而不是抛错。
   */
  safeGet: <K extends keyof (GlobalContext & C)>(
    key: K,
  ) => { success: true; data: (GlobalContext & C)[K] } | { success: false; error: string }
  /**
   * 安全获取当前请求的整个 Context。
   */
  safeGetAll: () => { success: true; data: GlobalContext & C } | { success: false; error: string }
  /**
   * 在指定 Context 下运行回调函数。
   * 适用于脱离请求生命周期时手动注入 Context（如定时任务、消息队列消费）。
   * 支持异步回调：Context 会保留到 Promise 结束后再清理。
   */
  run: <R>(store: GlobalContext & C, callback: () => R) => R
}

/**
 * 创建 Elysia 全局上下文插件。
 *
 * 通过 `AsyncLocalStorage` 在请求生命周期内安全存储与获取 Elysia Context，
 * 避免在 service / utils 等深层调用链中显式传递 context。
 *
 * 实现要点：
 * - 在 `onRequest` 同步阶段调用 `storage.enterWith(context)` 注入基础 Context（request 信息），
 *   再于 `onBeforeHandle` 中合并 `before` 回调返回的自定义数据（同一对象引用，handler 可读到）
 *   注意：不能在 `onBeforeHandle` 的 `await` 之后才 `enterWith`，
 *   Bun 下跨过 await 边界的 enterWith 不会传播到后续 handler
 * - 用 `WeakSet` 跟踪当前活跃的 Context 实例，`onAfterHandle` 阶段清理；
 *   `ctx.run` 内部也维护此集合，callback 结束（异步回调为 Promise 结束）自动清理
 *
 * 注意：
 * 1. 本插件**必须**通过 `app.use(plugin)` 在所有路由注册之前引入，
 *    否则 Elysia 的生命周期 hook 不会生效。
 * 2. 用户的 `onError` / `onAfterHandle` 也必须放在 `.use(plugin)` 之前，
 *    否则同样不会生效（Elysia 1.4 限制）。
 * 3. `ctx.get()` 仅在请求处理过程中或 `ctx.run` 注入范围内保证可用。
 *    请求错误时，plugin 不会主动清理 store，让用户的 `onError` 也能读到
 *    当前 Context（参考类似请求结束后 ctx.get 可能仍然有值的边界）。
 *
 * @example
 * ```ts
 * import { Elysia } from 'elysia'
 * import { createGlobalContextPlugin } from '@pika/elysia-plugins'
 *
 * const { ctx, plugin } = createGlobalContextPlugin()
 *
 * const app = new Elysia()
 *   .use(plugin) // 必须在所有 .get()/.post() 之前
 *   .get('/userinfo', () => getCurrentUser())
 *
 * // service/userService.ts —— 无需接收 context 参数
 * function getCurrentUser() {
 *   const { store } = ctx.get()
 *   return findById(store.userId)
 * }
 * ```
 *
 * @returns `{ ctx, plugin }`，`ctx` 用于在任意位置访问 Context，`plugin` 用于 `app.use(plugin)` 注册。
 */
export const createGlobalContextPlugin = <CustomContext extends Record<string, any> = {}>(
  onBeforeHandle?: (context: ElysiaContext) => CustomContext | Promise<CustomContext>,
) => {
  type ContextMerged = GlobalContext & CustomContext

  /**
   * 未注入 Context 时的统一错误消息。
   * `get` / `set` / `safeGet` 共用此文案，避免分散维护。
   */
  const NOT_FOUND_CONTEXT_ERROR =
    'not found context, please use ctx.run(context, () => { /* xxx */ }) to wrap your code, or use in onBeforeHandle after.'

  const storage = new AsyncLocalStorage<ContextMerged>()
  /**
   * 用 WeakSet 跟踪当前活跃的 Context 实例。
   * - 自动注入：`onRequest` 中 `add`，`onAfterHandle` 中 `delete`
   * - 手动注入：`ctx.run` 中 `add`，callback 结束后 `delete`
   *
   * `WeakSet` 持有的 Context 一旦外部无引用就会被 GC 自动清理，
   * 兜底避免长期泄漏。
   */
  const activeContexts = new WeakSet<ContextMerged>()

  /**
   * ctx 获取变量，建议挂载到 globalThis
   * @example
   * ```ts
   * declare global {
   *   var ctx: GlobalCtx
   * }
   *
   * // anyway
   *
   * ctx.get().xxx
   * ```
   */
  const ctx: GlobalCtx<CustomContext> = {
    get(_key) {
      const result = this.safeGetAll()
      if (!result.success) throw new Error(result.error)
      return result.data[_key]
    },
    getAll() {
      const result = this.safeGetAll()
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    set(_key, val) {
      if (val === undefined || val === null) {
        throw new Error('Cannot set undefined or null')
      }
      const store = storage.getStore()
      if (store === undefined || !activeContexts.has(store)) {
        throw new Error(NOT_FOUND_CONTEXT_ERROR)
      }
      ;(store as Record<string, any>)[_key as string] = val
      return this
    },
    safeGet(_key) {
      const result = this.safeGetAll()
      if (!result.success) {
        return result
      }
      const val = result.data[_key]
      if (val !== undefined && val !== null) {
        return { success: true, data: val }
      }
      return {
        success: false,
        error: `${typeof _key === 'string' ? _key : String(_key)} is not injected`,
      }
    },
    safeGetAll() {
      const val = storage.getStore()
      if (val === undefined || !activeContexts.has(val)) {
        return { success: false, error: NOT_FOUND_CONTEXT_ERROR }
      }
      return { success: true, data: val }
    },
    run<R>(store: ContextMerged, callback: () => R) {
      activeContexts.add(store)
      const cleanup = () => {
        activeContexts.delete(store)
      }
      try {
        const result = storage.run(store, callback)
        // 异步回调需等 Promise 结束后再清理，否则首个 await 之后 safeGet 就取不到 Context
        if (result instanceof Promise) {
          return result.finally(cleanup) as R
        }
        cleanup()
        return result
      } catch (error) {
        cleanup()
        throw error
      }
    },
  }

  const plugin = new Elysia({ name: 'global-context-plugin' })
    .onRequest(() => {})
    .onBeforeHandle(async (context) => {
      const data: any = {}
      activeContexts.add(data)
      storage.enterWith(data)
      if (onBeforeHandle !== undefined) {
        Object.assign(data, await onBeforeHandle(context as unknown as ElysiaContext))
      }
      Object.assign(data, {
        request: {
          url: context.request.url,
          path: context.path,
          method: context.request.method,
          headers: context.headers as any,
        },
      })
    })
    .onAfterHandle(() => {
      const val = storage.getStore()
      if (val !== undefined && activeContexts.has(val)) {
        activeContexts.delete(val)
      }
    })
    .as('global')

  return { ctx, plugin }
}
