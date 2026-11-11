import { describe, expect, test } from 'bun:test'
import { ConfigService } from '@/system/services/config'

describe('ConfigService.UpdateBodySchema', () => {
  test('邮件配置只接受 4-8 位验证码', () => {
    expect(ConfigService.UpdateBodySchema.safeParse({ mail: { codeLen: 3 } }).success).toBeFalse()
    expect(ConfigService.UpdateBodySchema.safeParse({ mail: { codeLen: 4 } }).success).toBeTrue()
    expect(ConfigService.UpdateBodySchema.safeParse({ mail: { codeLen: 8 } }).success).toBeTrue()
    expect(ConfigService.UpdateBodySchema.safeParse({ mail: { codeLen: 9 } }).success).toBeFalse()
  })
})
