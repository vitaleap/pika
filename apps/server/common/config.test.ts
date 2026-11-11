import { describe, expect, test } from 'bun:test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const configPath = join(import.meta.dir, 'config.ts')

// config.ts 在模块顶层求值，需用子进程隔离环境变量
const runConfig = (env: Record<string, string> = {}) =>
  Bun.spawnSync({
    cmd: [process.execPath, '-e', `await import(${JSON.stringify(configPath)})`],
    cwd: tmpdir(),
    env: { ...process.env, JWT_SECRET: '', ...env },
    stdout: 'pipe',
    stderr: 'pipe',
  })

const readCacheUrl = (env: Record<string, string>) => {
  const proc = Bun.spawnSync({
    cmd: [
      process.execPath,
      '-e',
      `const { config } = await import(${JSON.stringify(configPath)}); console.log(config.cacheUrl)`,
    ],
    cwd: tmpdir(),
    env: { ...process.env, NODE_ENV: 'production', JWT_SECRET: 'secret', ...env },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  return proc.stdout.toString().trim()
}

describe('config', () => {
  test('生产环境缺少 JWT_SECRET 时拒绝启动', () => {
    const proc = runConfig({ NODE_ENV: 'production' })
    expect(proc.exitCode).not.toBe(0)
    expect(proc.stderr.toString()).toContain('JWT_SECRET')
  })

  test('生产环境设置 JWT_SECRET 后正常启动', () => {
    const proc = runConfig({ NODE_ENV: 'production', JWT_SECRET: 'secret' })
    expect(proc.exitCode).toBe(0)
  })

  test('开发环境未设置 JWT_SECRET 时使用默认值', () => {
    const proc = runConfig({ NODE_ENV: 'development' })
    expect(proc.exitCode).toBe(0)
  })

  test('CACHE_URL 未配置或留空时回退默认文件缓存目录', () => {
    const cacheUrl = readCacheUrl({ CACHE_URL: '' })
    expect(cacheUrl.endsWith('/.pika/data/.cache')).toBe(true)
  })

  test('CACHE_URL=memory 时使用内存缓存', () => {
    expect(readCacheUrl({ CACHE_URL: 'memory' })).toBe('memory')
  })
})
