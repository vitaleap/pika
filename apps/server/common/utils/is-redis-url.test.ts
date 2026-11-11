import { describe, expect, test } from 'bun:test'
import { isRedisUrl } from '@/common/utils/is-redis-url'

describe('isRedisUrl', () => {
  test('识别 redis 与 valkey 连接串', () => {
    expect(isRedisUrl('redis://localhost:6379/0')).toBeTrue()
    expect(isRedisUrl('rediss://:pwd@redis.example.com:6379/0')).toBeTrue()
    expect(isRedisUrl('valkey://localhost:6379/0')).toBeTrue()
    expect(isRedisUrl('valkeys://:pwd@valkey.example.com:6379/0')).toBeTrue()
  })

  test('文件目录或空值视为非 redis', () => {
    expect(isRedisUrl('/data/cache')).toBeFalse()
    expect(isRedisUrl('.cache')).toBeFalse()
    expect(isRedisUrl('')).toBeFalse()
  })
})
