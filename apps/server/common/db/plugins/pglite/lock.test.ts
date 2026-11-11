import { existsSync } from 'node:fs'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { hostname } from 'node:os'
import { afterEach, describe, expect, test } from 'bun:test'
import dayjs from 'dayjs'
import { acquireDirLock, DEFAULT_HEARTBEAT_TIMEOUT, type DirLock } from './lock'

const dataDir = '.tmp/.test/.lock.pglite.data'
const lockPath = `${dataDir}.lock`

const clean = () => rm(lockPath, { force: true })

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

describe('pglite 数据目录锁', () => {
  afterEach(clean)

  test('加锁时生成锁文件，释放后删除', async () => {
    const release = await acquireDirLock(dataDir)
    expect(existsSync(lockPath)).toBe(true)
    await release()
    expect(existsSync(lockPath)).toBe(false)
  })

  test('心跳新鲜时不能重复加锁', async () => {
    const release = await acquireDirLock(dataDir)
    await expect(acquireDirLock(dataDir)).rejects.toThrow(
      /最近心跳 \d+s 前（\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}）/,
    )
    await release()
  })

  test('锁文件记录可读时间，心跳刷新时同步更新', async () => {
    const release = await acquireDirLock(dataDir, { heartbeatInterval: 10, heartbeatTimeout: 50 })
    const first = await readLockFile()
    const pattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/
    expect(first.startedTime).toMatch(pattern)
    expect(first.heartbeatTime).toMatch(pattern)

    await Bun.sleep(60)
    const second = await readLockFile()
    expect(second.heartbeatTime > first.heartbeatTime).toBe(true)
    await release()
  })

  test('心跳超过阈值后允许接管', async () => {
    await writeLock({ heartbeatTime: timeOf(Date.now() - DEFAULT_HEARTBEAT_TIMEOUT - 1000) })
    const release = await acquireDirLock(dataDir)
    expect(existsSync(lockPath)).toBe(true)
    await release()
    expect(existsSync(lockPath)).toBe(false)
  })

  test('心跳持续刷新，锁不会被误判过期', async () => {
    const release = await acquireDirLock(dataDir, { heartbeatInterval: 10, heartbeatTimeout: 50 })
    await Bun.sleep(150)
    await expect(acquireDirLock(dataDir, { heartbeatTimeout: 50 })).rejects.toThrow('已被占用')
    await release()
  })

  test('锁文件内容损坏时视为过期，允许接管', async () => {
    await writeFile(lockPath, 'not-json')
    const release = await acquireDirLock(dataDir)
    await release()
    expect(existsSync(lockPath)).toBe(false)
  })

  test('锁被接管后，原持有者释放不会删掉新锁', async () => {
    // 第一个实例不刷新心跳、也不做归属检查，由测试自己控制时序
    const releaseFirst = await acquireDirLock(dataDir, {
      heartbeatInterval: 60_000,
      heartbeatTimeout: 10,
      checkInterval: 60_000,
      onLockLost: () => {},
    })
    await Bun.sleep(20)

    const releaseSecond = await acquireDirLock(dataDir, { heartbeatTimeout: 10 })
    const token = await readToken()

    await releaseFirst()
    expect(existsSync(lockPath)).toBe(true)
    expect(await readToken()).toBe(token)

    await releaseSecond()
    expect(existsSync(lockPath)).toBe(false)
  })

  test('锁被接管后，原持有者会收到 onLockLost 通知', async () => {
    let lostHolder: DirLock | undefined
    const releaseFirst = await acquireDirLock(dataDir, {
      heartbeatInterval: 60_000,
      heartbeatTimeout: 10,
      checkInterval: 10,
      onLockLost: (holder) => {
        lostHolder = holder
      },
    })
    await Bun.sleep(20)

    const releaseSecond = await acquireDirLock(dataDir, { heartbeatTimeout: 10 })
    const token = await readToken()

    // 等待第一个实例的下一次归属检查
    await Bun.sleep(60)
    expect(lostHolder?.token).toBe(token)

    await releaseFirst()
    await releaseSecond()
    expect(existsSync(lockPath)).toBe(false)
  })
})
