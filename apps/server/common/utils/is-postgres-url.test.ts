import { describe, expect, test } from 'bun:test'
import { isPostgresUrl } from '@/common/utils/is-postgres-url'

describe('isPostgresUrl', () => {
  test('仅识别 postgresql:// 前缀', () => {
    expect(isPostgresUrl('postgresql://user:pwd@localhost:5432/db')).toBeTrue()
    expect(isPostgresUrl('postgres://user:pwd@localhost:5432/db')).toBeFalse()
  })

  test('其他值视为 PGlite 数据目录', () => {
    expect(isPostgresUrl('.tmp/.pglite.data')).toBeFalse()
    expect(isPostgresUrl('')).toBeFalse()
    expect(isPostgresUrl(undefined)).toBeFalse()
  })
})
