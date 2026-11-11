import { describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createLogger } from '../src/logger'

describe('createLogger', () => {
  test('filePath 时写入日志文件', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pika-log-'))
    const filePath = join(dir, 'nested', 'server.log')
    try {
      const log = createLogger({ level: 'info', mode: 'development', filePath })
      log.info('hello-log')
      expect(await readFile(filePath, 'utf8')).toContain('hello-log')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
