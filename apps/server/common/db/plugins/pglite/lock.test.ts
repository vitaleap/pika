import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { hostname } from 'node:os'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import dayjs from 'dayjs'
import {
  acquireDirLock,
  DEFAULT_HEARTBEAT_TIMEOUT,
  type DirLock,
  type DirLockOptions,
} from './lock'

/** 每个用例用独立的数据目录，避免用例之间通过锁文件互相干扰 */
const baseDir = '.tmp/.test/pglite-lock'
let caseDir = ''
let dataDir = ''
let lockPath = ''

/** 用例失败时 release 不会被调用，残留的定时器会读到已删除的锁文件并触发默认 onLockLost 直接退出进程 */
const acquire = (dir: string, options?: DirLockOptions) =>
  acquireDirLock(dir, { onLockLost: () => {}, ...options })

const readLockFile = async () => JSON.parse(await readFile(lockPath, 'utf8')) as DirLock

const readToken = async () => (await readLockFile()).token

/** 与锁文件里的时间格式保持一致 */
const timeOf = (ms: number) => dayjs(ms).format('YYYY-MM-DD HH:mm:ss.SSS')

const writeLock = (overrides: Partial<DirLock> = {}) =>
  writeFile(
    lockPath,
    JSON.stringify({
      pid: 1,
      startedTime: timeOf(Date.now()),
      host: hostname(),
      heartbeatTime: timeOf(Date.now()),
      token: 'stale',
      ...overrides,
    }),
  )

/** 轮询等待条件成立：比固定 sleep 更快，超时报错也更明确 */
const waitUntil = async (check: () => boolean | Promise<boolean>, timeout = 2000) => {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (await check()) {
      return
    }
    await Bun.sleep(5)
  }
  throw new Error(`等待条件超时（${timeout}ms）`)
}

/** 模拟锁被接管：第一个实例不刷新心跳，心跳过期后由第二个实例接管 */
const takeOver = async (
  checkInterval: number,
  onLockLost: (holder: DirLock | undefined) => void = () => {},
) => {
  const releaseFirst = await acquire(dataDir, {
    heartbeatInterval: 60_000,
    heartbeatTimeout: 10,
    checkInterval,
    onLockLost,
  })
  await waitUntil(async () => {
    const { heartbeatTime } = await readLockFile()
    // 解析方式与 lock.ts 的 parseTime 一致：无时区时按本地时间
    return Date.now() - new Date(heartbeatTime.replace(' ', 'T')).getTime() > 10
  })
  // 第二个实例也要传 10ms 阈值才能接管；它自己按默认 10s 刷心跳，避免心跳写与 release 的 unlink 竞争
  const releaseSecond = await acquire(dataDir, { heartbeatTimeout: 10 })
  return { releaseFirst, releaseSecond }
}

describe('pglite 数据目录锁', () => {
  beforeEach(async () => {
    caseDir = `${baseDir}/${crypto.randomUUID()}`
    dataDir = `${caseDir}/data`
    lockPath = `${dataDir}.lock`
    await mkdir(dataDir, { recursive: true })
  })

  afterEach(() => rm(caseDir, { recursive: true, force: true }))

  test('加锁时生成锁文件，释放后删除', async () => {
    const release = await acquire(dataDir)
    expect(existsSync(lockPath)).toBe(true)
    await release()
    expect(existsSync(lockPath)).toBe(false)
  })

  test('心跳新鲜时不能重复加锁', async () => {
    const release = await acquire(dataDir)
    await expect(acquireDirLock(dataDir)).rejects.toThrow(
      /最近心跳 \d+s 前（\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}）/,
    )
    await release()
  })

  test('锁文件记录可读时间，心跳刷新时同步更新', async () => {
    const release = await acquire(dataDir, { heartbeatInterval: 10, heartbeatTimeout: 500 })
    const first = await readLockFile()
    const pattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/
    expect(first.startedTime).toMatch(pattern)
    expect(first.heartbeatTime).toMatch(pattern)

    // 心跳每 10ms 写一次，这里等它真的刷新
    await waitUntil(async () => (await readLockFile()).heartbeatTime > first.heartbeatTime)
    await release()
  })

  test('心跳超过阈值后允许接管', async () => {
    await writeLock({ heartbeatTime: timeOf(Date.now() - DEFAULT_HEARTBEAT_TIMEOUT - 1000) })
    const release = await acquire(dataDir)
    expect(existsSync(lockPath)).toBe(true)
    await release()
    expect(existsSync(lockPath)).toBe(false)
  })

  test('心跳持续刷新，锁不会被误判过期', async () => {
    // 阈值要远大于 CI 上偶发的事件循环停顿，否则会把活着的锁误判成过期；
    // sleep 只需明显大于阈值：心跳真停了，这里就一定会被判过期
    const heartbeatTimeout = 500
    const release = await acquire(dataDir, { heartbeatInterval: 10, heartbeatTimeout })
    await Bun.sleep(heartbeatTimeout * 2)
    await expect(acquireDirLock(dataDir, { heartbeatTimeout })).rejects.toThrow('已被占用')
    await release()
  })

  test('锁文件内容损坏时视为过期，允许接管', async () => {
    await writeFile(lockPath, 'not-json')
    const release = await acquire(dataDir)
    await release()
    expect(existsSync(lockPath)).toBe(false)
  })

  test('锁被接管后，原持有者释放不会删掉新锁', async () => {
    const { releaseFirst, releaseSecond } = await takeOver(60_000)
    const token = await readToken()

    await releaseFirst()
    expect(existsSync(lockPath)).toBe(true)
    expect(await readToken()).toBe(token)

    await releaseSecond()
    expect(existsSync(lockPath)).toBe(false)
  })

  test('锁被接管后，原持有者会收到 onLockLost 通知', async () => {
    let lostHolder: DirLock | undefined
    const { releaseFirst, releaseSecond } = await takeOver(10, (holder) => {
      lostHolder = holder
    })
    const token = await readToken()

    // 等第一个实例的下一次归属检查
    await waitUntil(() => lostHolder !== undefined)
    expect(lostHolder?.token).toBe(token)

    await releaseFirst()
    await releaseSecond()
    expect(existsSync(lockPath)).toBe(false)
  })
})
