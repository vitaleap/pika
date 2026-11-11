import { describe, expect, test } from 'bun:test'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { resolvePath } from '../src/utils/path'

describe('resolvePath', () => {
  test('展开 ~ 前缀为用户主目录', () => {
    expect(resolvePath('~/.pika/data/.cache')).toBe(resolve(homedir(), '.pika/data/.cache'))
  })

  test('单独的 ~ 展开为主目录', () => {
    expect(resolvePath('~')).toBe(homedir())
  })

  test('相对路径解析为基于 cwd 的绝对路径', () => {
    expect(resolvePath('.tmp/.cache')).toBe(resolve('.tmp/.cache'))
  })

  test('绝对路径保持不变', () => {
    expect(resolvePath('/data/cache')).toBe('/data/cache')
  })
})
