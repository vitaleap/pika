import dayjs from 'dayjs'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, unlinkSync } from 'node:fs'
import { link, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { hostname } from 'node:os'
import { dirname } from 'node:path'

/** 默认每 10s 写一次心跳 */
export const DEFAULT_HEARTBEAT_INTERVAL = 10_000
/** 默认超过 30s 没心跳，就认为持有者已经退出，允许其他程序接管 */
export const DEFAULT_HEARTBEAT_TIMEOUT = 30_000
/** 默认每 1s 检查一次锁归属，尽快发现"自己已被接管" */
export const DEFAULT_CHECK_INTERVAL = 1_000

/** `<dataDir>.lock` 的内容 */
export interface DirLock {
  pid: number
  /** 进程启动时间（本地时间，仅用于排查问题），`ps` 拿不到时退化为加锁时间 */
  startedTime: string
  host: string
  /** 最近一次心跳时间（本地时间），超过 timeout 即视为持有者已退出 */
  heartbeatTime: string
  /** 本次加锁的唯一标识，用于释放/心跳时确认锁还是自己的 */
  token: string
}

export interface DirLockOptions {
  /** 心跳写入间隔，默认 10s */
  heartbeatInterval?: number
  /** 心跳过期阈值，默认 30s */
  heartbeatTimeout?: number
  /** 检查锁归属的间隔，默认 1s */
  checkInterval?: number
  /**
   * 发现锁已被别的进程接管时的处理，默认直接退出进程。
   *
   * 注意：这里绝不能去 `close()` 数据库 —— 那会把本进程的内存快照刷回磁盘，
   * 覆盖新持有者的数据。只允许做日志、上报之类的收尾动作。
   */
  onLockLost?: (holder: DirLock | undefined) => void
}

/** 默认策略：打印原因后立即退出，避免和新持有者同时写同一个数据目录 */
const exitOnLockLost = (holder: DirLock | undefined) => {
  const who = holder ? `pid=${holder.pid} host=${holder.host}` : '未知进程（锁文件已被删除或损坏）'
  process.stderr.write(`[pglite-lock] 数据目录锁已被 ${who} 接管，进程退出以避免数据损坏\n`)
  process.exit(1)
}

/** 可读的本地时间。保留毫秒：解析回来要参与过期判断，只到秒会多算近 1s，毫秒级 timeout 会误判过期 */
const formatTime = (ms: number) => dayjs(ms).format('YYYY-MM-DD HH:mm:ss.SSS')

/** 解析锁文件里的时间，缺失或非法时返回 undefined（按“锁已过期”处理） */
function parseTime(time: string | undefined): number | undefined {
  if (!time) {
    return undefined
  }
  // `YYYY-MM-DD HH:mm:ss.SSS` 换成 ISO 的 `T` 分隔符，无时区时按本地时间解析
  const value = new Date(time.replace(' ', 'T')).getTime()
  return Number.isNaN(value) ? undefined : value
}

/** 读取进程的真实启动时间，`ps` 不可用时返回 undefined */
function processStartTime(pid: number): number | undefined {
  try {
    const output = execFileSync('ps', ['-p', String(pid), '-o', 'lstart='], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    const time = new Date(output).getTime()
    return Number.isNaN(time) ? undefined : time
  } catch {
    return undefined
  }
}

async function readLock(lockPath: string): Promise<DirLock | undefined> {
  try {
    return JSON.parse(await readFile(lockPath, 'utf8')) as DirLock
  } catch {
    return undefined
  }
}

/** 锁文件短暂不存在（接管空窗）时的重试次数与间隔，合计不超过一次 checkInterval */
const LOCK_READ_RETRIES = 3
const LOCK_READ_RETRY_INTERVAL = 10

/** 读取当前锁持有者：接管是“rename 旧锁 → 创建新锁”，两步之间锁文件短暂不存在 */
async function readLockSettled(lockPath: string): Promise<DirLock | undefined> {
  let current = await readLock(lockPath)
  for (let attempt = 0; !current && attempt < LOCK_READ_RETRIES; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, LOCK_READ_RETRY_INTERVAL))
    current = await readLock(lockPath)
  }
  return current
}

/**
 * 原子创建：先把内容写进临时文件，再 link 过去。
 * link 不会覆盖已有文件（目标存在时抛 EEXIST），且读取方不会看到半截内容。
 */
async function createLockFile(tmpPath: string, lockPath: string): Promise<boolean> {
  try {
    await link(tmpPath, lockPath)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      return false
    }
    throw error
  }
}

/**
 * 在 dataDir 旁维护 `<dataDir>.lock`，保证同一数据目录只会被一个程序打开。
 *
 * PGlite 自身没有跨进程锁（`postmaster.pid` 里是假 pid，也没有 stale 检测），
 * 两个实例同时打开同一目录会各自持有内存快照并互相覆盖，导致丢数据。
 *
 * - 锁不存在：用 link 原子创建；
 * - 心跳新鲜：拒绝启动；
 * - 心跳超过 `heartbeatTimeout`（默认 30s）：用 rename 抢占，同时判定过期时只有一个能成功。
 *
 * 持有期间每 `heartbeatInterval`（默认 10s）刷新心跳，每 `checkInterval`（默认 1s）校验归属；
 * 进程被挂起导致锁被接管时按 `onLockLost` 处理（默认退出），避免两个进程同时写同一目录。
 *
 * 返回的 release 可以安全地重复调用。
 */
export async function acquireDirLock(
  dataDir: string,
  options: DirLockOptions = {},
): Promise<() => Promise<void>> {
  const {
    heartbeatInterval = DEFAULT_HEARTBEAT_INTERVAL,
    heartbeatTimeout = DEFAULT_HEARTBEAT_TIMEOUT,
    checkInterval = DEFAULT_CHECK_INTERVAL,
    onLockLost = exitOnLockLost,
  } = options

  const lockPath = `${dataDir}.lock`
  mkdirSync(dirname(lockPath), { recursive: true })

  const now = Date.now()
  const lock: DirLock = {
    pid: process.pid,
    startedTime: formatTime(processStartTime(process.pid) ?? now),
    host: hostname(),
    heartbeatTime: formatTime(now),
    token: crypto.randomUUID(),
  }

  const tmpPath = `${lockPath}.${lock.token}.tmp`
  const stalePath = `${lockPath}.${lock.token}.stale`
  await writeFile(tmpPath, JSON.stringify(lock))

  try {
    let locked = false
    for (let attempt = 0; attempt < 3; attempt++) {
      // 1. 锁不存在 → 原子创建
      if (await createLockFile(tmpPath, lockPath)) {
        locked = true
        break
      }

      // 2. 锁存在 → 心跳新鲜就拒绝启动
      const holder = await readLock(lockPath)
      const heartbeatAt = parseTime(holder?.heartbeatTime)
      if (holder && heartbeatAt !== undefined && Date.now() - heartbeatAt <= heartbeatTimeout) {
        const age = Math.max(0, Math.round((Date.now() - heartbeatAt) / 1000))
        throw new Error(
          `数据目录已被占用: ${dataDir}（pid=${holder.pid} host=${holder.host}，` +
            `最近心跳 ${age}s 前（${holder.heartbeatTime}），` +
            `超过 ${Math.round(heartbeatTimeout / 1000)}s 无心跳后可自动接管）`,
        )
      }

      // 3. 心跳过期 → 原子接管，同时判定过期时只有一个能 rename 成功
      try {
        await rename(lockPath, stalePath)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          continue // 别的进程抢先接管了，回到第 1 步重新判断
        }
        throw error
      }
      await unlink(stalePath).catch(() => {})
    }
    if (!locked) {
      throw new Error(`无法获取数据目录锁: ${lockPath}`)
    }
  } finally {
    await unlink(tmpPath).catch(() => {})
  }

  let lost = false
  let running = false
  // 心跳时间在内存里保留毫秒值，避免每次检查都去解析锁文件里的字符串
  let heartbeatAt = now

  /**
   * 定期校验归属 + 刷新心跳。校验比心跳更频繁：进程被挂起恢复后能在 checkInterval 内
   * 发现锁已被接管，把“两个实例同时写”的窗口从心跳间隔压缩到 1s 左右。
   */
  const check = async () => {
    if (lost || running) {
      return
    }
    running = true
    try {
      const current = await readLockSettled(lockPath)
      if (current?.token !== lock.token) {
        lost = true
        clearInterval(timer)
        onLockLost(current)
        return
      }
      if (Date.now() - heartbeatAt < heartbeatInterval) {
        return
      }
      heartbeatAt = Date.now()
      lock.heartbeatTime = formatTime(heartbeatAt)
      await writeFile(tmpPath, JSON.stringify(lock))
      // rename 是原子的，读取方只会看到旧内容或新内容，不会看到半截
      await rename(tmpPath, lockPath)
    } finally {
      running = false
    }
  }

  const timer = setInterval(
    () => {
      check().catch(() => {})
    },
    Math.min(checkInterval, heartbeatInterval),
  )
  // 不要因为检查定时器把进程挂住
  timer.unref()

  // 兜底：进程退出时只能同步操作，SIGKILL / 断电等场景留给下次启动的心跳过期判定
  const onExit = () => {
    try {
      const current = JSON.parse(readFileSync(lockPath, 'utf8')) as DirLock
      if (current.token === lock.token) {
        unlinkSync(lockPath)
      }
    } catch {}
  }
  process.on('exit', onExit)

  let released = false
  return async () => {
    if (released) {
      return
    }
    released = true
    clearInterval(timer)
    process.off('exit', onExit)
    // 只删自己的锁，避免误删别人接管后的新锁
    if ((await readLock(lockPath))?.token === lock.token) {
      await unlink(lockPath).catch(() => {})
    }
    await unlink(tmpPath).catch(() => {})
  }
}
