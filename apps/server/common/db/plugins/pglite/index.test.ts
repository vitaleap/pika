import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { afterAll, describe, expect, test } from 'bun:test'
import { createPGlite } from './index'

const dataDir = '.tmp/.test/.create.pglite.data'
const lockPath = `${dataDir}.lock`
// 每次打开都要初始化一整个 PGlite 集群（CPU 密集，空载约 0.7s），默认的 5s 单测概率触发超时。
const TIMEOUT = 30_000

const clean = async () => {
  await rm(dataDir, { recursive: true, force: true })
  await rm(lockPath, { force: true })
}

describe('createPGlite 与数据目录锁', () => {
  afterAll(clean)

  test(
    '打开时加锁，同一数据目录不能重复打开，关闭时释放',
    async () => {
      const db = await createPGlite(dataDir)
      expect(existsSync(lockPath)).toBe(true)

      expect(createPGlite(dataDir)).rejects.toThrow('已被占用')

      await db.close()
      expect(existsSync(lockPath)).toBe(false)
    },
    TIMEOUT,
  )
})
