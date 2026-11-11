type HookHandler = () => Promise<void> | void
type Hook = {
  order: number
  putIdx: number
  handler: HookHandler
}

/**
 * 钩子执行顺序预设，值越小越先执行。
 *
 * 队列按 `order` 升序、同 `order` 按注册顺序执行；未传 `sort` 时使用 `HookOrder.Default`。
 *
 * 请直接使用这些预设，不要手写数字或做浮点运算：
 * `Number.MIN_VALUE` 是最小正数（`5e-324`），比默认值 `0` 更大，
 * 且 `Number.MIN_VALUE + 1 === 1`，会因浮点精度丢失得到意料之外的结果。
 */
export const HookOrder = {
  /** 最先执行：无外部依赖的基础设施初始化 */
  First: -10000,
  /** 较早执行：数据库连接与迁移等基础依赖 */
  Early: -5000,
  /** 默认顺序：业务模块自身的钩子 */
  Default: 0,
  /** 较晚执行：业务钩子之后的收尾逻辑 */
  Late: 5000,
  /** 最后执行 */
  Last: 10000,
} as const

const startBeforeQueue: Hook[] = []
const shutdownBeforeQueue: Hook[] = []
const shutdownQueue: Hook[] = []
const startQueue: Hook[] = []

let shutdownListenersRegistered = false
let isShuttingDown = false

const pushHook = (queue: Hook[], fn: HookHandler, sort?: number) => {
  const order = sort ?? HookOrder.Default
  if (!Number.isInteger(order)) {
    throw new TypeError(
      `hook order 必须是整数，收到 ${order}；建议使用 HookOrder.xxx 预设，避免浮点精度问题`,
    )
  }
  queue.push({
    putIdx: queue.length,
    order,
    handler: fn,
  })
}

const runHooks = async (queue: Hook[]) => {
  for (const item of queue.sort((a, b) => a.order - b.order || a.putIdx - b.putIdx)) {
    await item.handler()
  }
}

/**
 * 注册启动前任务，按 `order` 升序、同 `order` 按注册顺序执行
 * @param sort 顺序，值越小越先执行；请使用 `HookOrder` 预设，默认 `HookOrder.Default`
 */
export const onStartBefore = (fn: HookHandler, sort?: number) => {
  pushHook(startBeforeQueue, fn, sort)
}

/**
 * 注册启动后任务
 * @example
 * ```ts
 * onStart(async () => {
 *   await orm.init()
 * })
 * ```
 */
export const onStart = (fn: HookHandler, sort?: number) => {
  pushHook(startQueue, fn, sort)
}

/**
 * 注册关闭前任务（服务停止之前）
 */
export const onShutdownBefore = (fn: HookHandler, sort?: number) => {
  pushHook(shutdownBeforeQueue, fn, sort)
}

/**
 * 注册关闭后任务（服务停止之后）
 * @example
 * ```ts
 * onShutdown(async () => {
 *   await orm.clearData()
 * })
 * ```
 */
export const onShutdown = (fn: HookHandler, sort?: number) => {
  pushHook(shutdownQueue, fn, sort)
}

export const triggerOnStartBefore = async () => {
  await runHooks(startBeforeQueue)
}

export const triggerOnStart = async () => {
  await runHooks(startQueue)
}

export const triggerOnShutdownBefore = async () => {
  await runHooks(shutdownBeforeQueue)
}

export const triggerOnShutdown = async () => {
  await runHooks(shutdownQueue)
}

/**
 * 注册 SIGTERM / SIGINT 监听器，并在收到信号时调用 `stopCallback` 后退出进程。
 *
 * 监听器与 `isShuttingDown` 状态在模块作用域内单例，重复调用不会重复注册。
 *
 * @param stopCallback 收到信号时的清理逻辑；返回后进程退出码 0，抛出则退出码 1
 * @example
 * ```ts
 * gracefulShutdown(async () => {
 *   await server.stop()
 *   await triggerOnShutdown()
 * })
 * ```
 */
export const gracefulShutdown = (stopCallback: (signal: string) => Promise<void>): void => {
  const shutdown = async (signal: string) => {
    try {
      if (isShuttingDown) {
        return
      }
      isShuttingDown = true
      await stopCallback(signal)
      process.exit(0)
    } catch {
      process.exit(1)
    }
  }
  if (!shutdownListenersRegistered) {
    shutdownListenersRegistered = true
    process.on('SIGTERM', shutdown)
    process.on('SIGINT', shutdown)
  }
}
