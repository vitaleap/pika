import { describe, expect, test } from 'bun:test'
import { generateNumericCode } from '@/common/utils/crypto'

describe('generateNumericCode', () => {
  test('返回指定长度且仅含数字的验证码', () => {
    for (const length of [4, 6, 8]) {
      const code = generateNumericCode(length)
      expect(code).toHaveLength(length)
      expect(code).toMatch(/^\d+$/)
    }
  })

  test('不足位数时左侧补零，长度始终固定', () => {
    const codes = Array.from({ length: 200 }, () => generateNumericCode(6))
    expect(codes.every((code) => code.length === 6)).toBeTrue()
  })
})
