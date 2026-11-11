import { Elysia, type HTTPHeaders } from 'elysia'
import { randomUUID } from 'crypto'

/**
 * 把 `process.hrtime` 差值格式化为可读耗时字符串。
 * - 纳秒级：`xxxns`
 * - 微秒级：`xxxus`
 * - 毫秒级：`xxxms`
 * - 秒级以上：`xxxs`
 */
export const formatTime = ([diffSec, diffNs]: [number, number]): string => {
  if (diffSec > 0) {
    return `${diffSec}.${(diffNs / 1000000).toFixed(0)}s`
  }
  if (diffNs < 1000) {
    return `${diffNs}ns`
  }
  if (diffNs < 1000000) {
    return `${(diffNs / 1000).toFixed(2)}us`
  }
  return `${(diffNs / 1000000).toFixed(2)}ms`
}

export type ReqIdPluginOpts = {
  /**
   * 请求 ID 生成器。默认 `crypto.randomUUID()`，可注入分布式唯一 ID（如 snowflake）。
   */
  idGenerator?: () => string | Promise<string>
}

/**
 * 请求 ID 与耗时统计插件。
 * - 自动设置 `X-Req-Id` 响应头
 * - 自动设置 `X-Res-Time` 响应头（基于 `process.hrtime`）
 */
export const reqIdPlugin = (opts?: ReqIdPluginOpts) => {
  const generate = opts?.idGenerator ?? (() => randomUUID())
  /**
   * 每个请求的 ID 与开始时间，以 `request` 为 key 存储。
   *
   * 不能放在 `derive` 中：Elysia 2 的 `derive` 在校验之后执行，
   * 且 `onError` 上下文不再包含 derive 返回值。
   */
  const requestStates = new WeakMap<Request, { reqId: string; start: [number, number] }>()

  const setRespTime = (set: { headers: HTTPHeaders }, request: Request) => {
    const state = requestStates.get(request)
    if (state) set.headers['X-Res-Time'] = formatTime(process.hrtime(state.start))
  }

  return new Elysia({ name: 'req-id-plugin' })
    .onRequest(async ({ request, set }) => {
      const reqId = await generate()
      requestStates.set(request, { reqId, start: process.hrtime() })
      // 在 onRequest 阶段写入，保证校验失败时响应也带有请求 ID
      set.headers['X-Req-Id'] = reqId
    })
    .derive(({ request }) => ({
      reqId: requestStates.get(request)?.reqId ?? '',
    }))
    .onAfterHandle(({ set, request }) => {
      setRespTime(set, request)
    })
    .onError(({ set, request }) => {
      setRespTime(set, request)
    })
    .as('global')
}
