import { SnowflakeIdv1 } from 'simple-flakeid'

/**
 * Snowflake 环境变量配置。所有字段可选；未设置时使用默认值。
 */
export interface SnowflakeEnv {
  /**
   * 机器码位长，默认值 10，取值范围 [1, 15](要求：序列数位长+机器码位长不超过 22)
   */
  SNOWFLAKE_WORKER_ID_BIT_LENGTH?: string
  /**
   * 序列数位长，默认值 10，取值范围 [3, 21](要求：序列数位长+机器码位长不超过 22)
   */
  SNOWFLAKE_SEQ_BIT_LENGTH?: string
}

/**
 * 雪花 ID 生成所需的最小 cache 接口（结构化类型，兼容 `@seepine/cache` 等实现）。
 */
export interface SnowflakeCache {
  get<T>(key: string): Promise<T | undefined>
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<unknown>
  del(key: string): Promise<unknown>
  lock<T>(key: string, fn: () => Promise<T>): Promise<T>
}

/**
 * 关闭钩子注册函数；签名与 `@pika/elysia-hook` 的 `onShutdown` 兼容。
 */
export type SnowflakeShutdownRegister = (fn: () => Promise<void> | void) => void

/**
 * 可选 logger；不传则静默初始化。
 */
export interface SnowflakeLogger {
  info: (msg: string) => void
}

export interface SnowflakeDeps {
  cache: SnowflakeCache
  env?: SnowflakeEnv
  log?: SnowflakeLogger
}

export interface SnowflakeService {
  /** 初始化雪花 ID 实例；幂等，可重复调用 */
  init: () => Promise<void>
  /** 清理定时器雪花ID等 */
  cleanup: () => Promise<void>
  /** 获取当前 worker ID */
  getWorkerId: () => number
  /** 生成下一个 bigint ID（需要先调用 init） */
  nextBigId: () => Promise<bigint>
  /** 生成下一个字符串 ID（需要先调用 init） */
  nextId: () => string
  /** 生成下一个字符串 ID（懒初始化，未调用 init 时自动初始化） */
  nextIdSafe: () => Promise<string>
}

const parseOpts = (env?: SnowflakeEnv) => ({
  workerId: 0,
  workerIdBitLength: parseInt(env?.SNOWFLAKE_WORKER_ID_BIT_LENGTH || '10'),
  seqBitLength: parseInt(env?.SNOWFLAKE_SEQ_BIT_LENGTH || '10'),
})

/**
 * 创建雪花 ID 生成器。
 *
 * 通过依赖注入复用调用方的 cache 与关闭钩子注册器，避免包内 import 具体实现。
 * 框架中立，可在任意 Node / Bun 服务中复用。
 *
 * @example
 * ```ts
 * const snowflake = createSnowflake({ cache, onShutdown, env: Bun.env })
 * await snowflake.init()
 * const id = snowflake.nextId()
 * ```
 */
export const createSnowflake = ({ cache, env, log }: SnowflakeDeps): SnowflakeService => {
  const opts = parseOpts(env)
  let inst: SnowflakeIdv1 | undefined

  const requireInst = (): SnowflakeIdv1 => {
    if (!inst) {
      throw new Error('snowflake.init() must be called first')
    }
    return inst
  }

  let timer: NodeJS.Timeout | undefined
  const cleanup = async () => {
    inst = undefined
    const key = `snowflake_worker_id:${opts.workerId}`
    clearInterval(timer)
    await cache.del(key)
  }

  /**
   * 获取 workerId 集群时通过 redis 实现多实例 workerId 互斥
   * @returns
   */
  const getWorkerId = async () => {
    const maxWorkerId = Math.pow(2, opts.workerIdBitLength) - 1
    for (let workerId = 0; workerId <= maxWorkerId; workerId++) {
      const key = `snowflake_worker_id:${workerId}`
      if ((await cache.get<string>(key)) !== undefined) {
        continue
      }
      await cache.set(key, workerId, 45)
      timer = setInterval(async () => {
        await cache.set(key, workerId, 45)
      }, 20 * 1000)
      return workerId
    }
    return opts.workerId
  }

  const initInstance = () => {
    return cache.lock('init_snowflake_work_id', async () => {
      if (inst) {
        return inst
      }
      opts.workerId = await getWorkerId()
      inst = new SnowflakeIdv1(opts)
      return inst
    })
  }

  return {
    init: async () => {
      if (!inst) {
        inst = await initInstance()
      }
      // simple-flakeid 内部字段名首字母大写，未在公开类型中暴露
      log?.info(`[snowflake] initialized with worker ID: ${inst['WorkerId']}`)
    },
    cleanup,
    getWorkerId: () => opts.workerId,
    nextBigId: async () => requireInst().NextBigId(),
    nextId: () => requireInst().NextBigId().toString(),
    nextIdSafe: async () => {
      if (!inst) {
        inst = await initInstance()
      }
      return inst.NextBigId().toString()
    },
  }
}
