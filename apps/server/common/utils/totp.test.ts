import { describe, expect, test } from 'bun:test'
import {
  buildTotpUri,
  decodeBase32,
  generateTotp,
  generateTotpSecret,
  randomBase32,
  verifyTotp,
  verifyTotpCounter,
} from './totp'

describe('TOTP-base32', () => {
  test('randomBase32 只输出字母表内字符', () => {
    expect(randomBase32(32)).toMatch(/^[A-Z2-7]{32}$/)
    expect(randomBase32(10)).toHaveLength(10)
  })

  test('解码结果与编码前字节一致', () => {
    expect(decodeBase32('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ').toString()).toBe('12345678901234567890')
  })

  test('32 位随机密钥解码后为 20 字节', () => {
    expect(decodeBase32(generateTotpSecret())).toHaveLength(20)
  })

  test('解码时忽略大小写与填充符', () => {
    expect(decodeBase32('jbsw y3dp ehpk 3pxp')).toEqual(decodeBase32('JBSWY3DPEHPK3PXP'))
  })

  test('非法字符抛错', () => {
    expect(() => decodeBase32('JBSWY3DPEHPK3PX0')).toThrow('invalid base32 character')
  })
})

describe('TOTP', () => {
  // RFC 6238 附录 B 的 SHA1 测试向量，密钥为 "12345678901234567890" 的 base32
  const rfcSecret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'

  /**
   * 构造一个确定不会命中校验窗口（当前时间步长及前后各一个）的 6 位错误码。
   * 窗口内最多命中 3 个码，从 4 个候选中必能挑出一个不冲突的，因此断言不会偶发失败。
   */
  const invalidCode = (secret: string, timestamp: number): string => {
    const valid = new Set(
      [-1, 0, 1].map((offset) => generateTotp(secret, { timestamp: timestamp + offset * 30_000 })),
    )
    return ['000000', '000001', '000002', '000003'].find((code) => !valid.has(code))!
  }

  test('与 RFC 6238 测试向量一致', () => {
    const vectors: Array<[number, string]> = [
      [59_000, '94287082'],
      [1_111_111_109_000, '07081804'],
      [1_111_111_111_000, '14050471'],
      [1_234_567_890_000, '89005924'],
      [2_000_000_000_000, '69279037'],
    ]
    for (const [timestamp, code] of vectors) {
      expect(generateTotp(rfcSecret, { timestamp, digits: 8 })).toBe(code)
    }
  })

  test('校验当前验证码成功，错误验证码失败', () => {
    const now = 1_700_000_000_000
    const code = generateTotp(rfcSecret, { timestamp: now })
    const wrong = invalidCode(rfcSecret, now)
    expect(verifyTotp(rfcSecret, code, { timestamp: now })).toBeTrue()
    expect(verifyTotp(rfcSecret, wrong, { timestamp: now })).toBeFalse()
    expect(verifyTotp(rfcSecret, 'abc', { timestamp: now })).toBeFalse()
  })

  test('容忍前后一个时间步长的时钟偏差', () => {
    const now = 1_700_000_000_000
    const previous = generateTotp(rfcSecret, { timestamp: now - 30_000 })
    expect(verifyTotp(rfcSecret, previous, { timestamp: now })).toBeTrue()
    const tooOld = generateTotp(rfcSecret, { timestamp: now - 120_000 })
    expect(verifyTotp(rfcSecret, tooOld, { timestamp: now })).toBeFalse()
  })

  test('返回命中的时间步长，供调用方防重放', () => {
    const secret = generateTotpSecret()
    const now = 1_700_000_000_000
    const counter = Math.floor(now / 1000 / 30)
    const current = generateTotp(secret, { timestamp: now })
    expect(verifyTotpCounter(secret, current, { timestamp: now })).toBe(counter)

    // 时钟偏差容忍窗口内命中的是上一个步长
    const previous = generateTotp(secret, { timestamp: now - 30_000 })
    expect(verifyTotpCounter(secret, previous, { timestamp: now })).toBe(counter - 1)
    expect(verifyTotpCounter(secret, invalidCode(secret, now), { timestamp: now })).toBeUndefined()
  })

  test('生成的密钥是 32 位 Base32 字符串', () => {
    expect(generateTotpSecret()).toMatch(/^[A-Z2-7]{32}$/)
  })

  test('otpauth URI 携带密钥与算法参数', () => {
    const uri = buildTotpUri({ secret: rfcSecret, account: 'a@b.com', issuer: 'Pika' })
    expect(uri).toStartWith('otpauth://totp/Pika%3Aa%40b.com?')
    expect(uri).toContain(`secret=${rfcSecret}`)
    expect(uri).toContain('algorithm=SHA1')
    expect(uri).toContain('digits=6')
    expect(uri).toContain('period=30')
  })
})
