import { describe, expect, test } from 'bun:test'
import { UserService } from '@/system/services/user'

const editEmailBody = (codeLength: number) => {
  const code = '1'.repeat(codeLength)
  return {
    oldEmail: 'old@gmail.com',
    newEmail: 'new@gmail.com',
    oldCode: code,
    newCode: code,
  }
}

describe('UserService.EditEmailBodySchema', () => {
  test('修改邮箱只接受 4-8 位验证码', () => {
    expect(UserService.EditEmailBodySchema.safeParse(editEmailBody(3)).success).toBeFalse()
    expect(UserService.EditEmailBodySchema.safeParse(editEmailBody(4)).success).toBeTrue()
    expect(UserService.EditEmailBodySchema.safeParse(editEmailBody(8)).success).toBeTrue()
    expect(UserService.EditEmailBodySchema.safeParse(editEmailBody(9)).success).toBeFalse()
  })
})
