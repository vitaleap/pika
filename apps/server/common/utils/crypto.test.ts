import { describe, expect, test } from 'bun:test'
import {
  decryptText,
  encryptText,
  generateNumericCode,
  hashPassword,
  hmacSha1,
  md5,
  sha256,
  verifyPassword,
} from '@/common/utils/crypto'

describe('摘要 / MAC', () => {
  test('md5 与已知向量一致', () => {
    expect(md5('')).toBe('d41d8cd98f00b204e9800998ecf8427e')
    expect(md5('abc')).toBe('900150983cd24fb0d6963f7d28e17f72')
  })

  test('sha256 与已知向量一致', () => {
    expect(sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  test('摘要对中文与超长输入同样稳定', () => {
    expect(sha256('两步验证')).toBe(sha256('两步验证'))
    expect(sha256('a'.repeat(100_000))).toHaveLength(64)
  })

  test('hmacSha1 与 RFC 2202 测试向量一致', () => {
    const vectors: Array<[Buffer, Buffer, string]> = [
      [Buffer.alloc(20, 0x0b), Buffer.from('Hi There'), 'b617318655057264e28bc0b6fb378c8ef146be00'],
      [
        Buffer.from('Jefe'),
        Buffer.from('what do ya want for nothing?'),
        'effcdf6ae5eb2fa2d27416d5f184df9c259a7c79',
      ],
      // 超过分组长度（64 字节）的密钥，验证内部会先对密钥做摘要
      [
        Buffer.alloc(80, 0xaa),
        Buffer.from('Test Using Larger Than Block-Size Key - Hash Key First'),
        'aa4ae5e15272d00e95705637ce8a3b55ed402112',
      ],
    ]
    for (const [key, data, expected] of vectors) {
      expect(hmacSha1(key, data).toString('hex')).toBe(expected)
    }
  })

  test('hmacSha1 密钥不同则摘要不同', () => {
    const data = Buffer.from('1234567890')
    expect(hmacSha1(Buffer.from('key-a'), data)).not.toEqual(hmacSha1(Buffer.from('key-b'), data))
  })
})

describe('对称加解密', () => {
  const secret = 'unit-test-secret'

  test('中英文与空串均可往返', () => {
    for (const plain of ['', '两步验证 secret', 'JBSWY3DPEHPK3PXP', 'x'.repeat(10_000)]) {
      expect(decryptText(encryptText(plain, secret), secret)).toBe(plain)
    }
  })

  test('密文为 iv:authTag:cipher 三段 base64', () => {
    const parts = encryptText('hello', secret).split(':')
    expect(parts).toHaveLength(3)
    for (const part of parts) {
      expect(part).toMatch(/^[A-Za-z0-9+/]+={0,2}$/)
    }
  })

  test('每次加密使用随机 iv，同一明文结果不同', () => {
    expect(encryptText('hello', secret)).not.toBe(encryptText('hello', secret))
  })

  test('密钥不匹配时解密抛错', () => {
    const payload = encryptText('hello', secret)
    expect(() => decryptText(payload, 'another-secret')).toThrow()
  })

  test('密文被篡改时解密抛错', () => {
    const [iv, authTag] = encryptText('hello', secret).split(':')
    const tampered = [iv, authTag, Buffer.from('tampered').toString('base64')].join(':')
    expect(() => decryptText(tampered, secret)).toThrow()
  })

  test('格式非法的密文抛错', () => {
    expect(() => decryptText('', secret)).toThrow('invalid encrypted payload')
    expect(() => decryptText('only-iv', secret)).toThrow('invalid encrypted payload')
  })
})

describe('口令哈希', () => {
  test('正确密码校验通过，错误密码校验失败', async () => {
    const hash = await hashPassword('pass1234')
    expect(await verifyPassword('pass1234', hash)).toBeTrue()
    expect(await verifyPassword('pass12345', hash)).toBeFalse()
  })

  test('相同密码每次哈希结果不同（随机 salt）', async () => {
    expect(await hashPassword('pass1234')).not.toBe(await hashPassword('pass1234'))
  })

  test('哈希串格式非法时抛错', async () => {
    expect(verifyPassword('pass1234', 'not-a-password-hash')).rejects.toThrow()
  })
})

describe('随机数', () => {
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
