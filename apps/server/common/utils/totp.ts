import { randomInt } from 'node:crypto'
import { hmacSha1 } from './crypto'

/** RFC 4648 Base32 字母表，otpauth 的密钥与大多数验证器 App 均使用该编码 */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/** 时间步长，单位秒（RFC 6238 默认值） */
const STEP = 30
/** 验证码位数（RFC 6238 默认值） */
const DIGITS = 6

/** 生成与校验的可选参数 */
type TotpOptions = {
  /** 允许的时间步长偏差 */
  window?: number
  /** 时间戳（毫秒），默认当前时间 */
  timestamp?: number
  /** 验证码位数 */
  digits?: number
}

/**
 * 生成指定长度的 Base32 随机串。
 *
 * 直接按字母表取随机字符：每个字符恰好 5 bit，无需“先取随机字节再编码”，也没有末尾补位的浪费。
 * @param length 字符数
 */
export const randomBase32 = (length: number): string =>
  Array.from({ length }, () => BASE32_ALPHABET[randomInt(BASE32_ALPHABET.length)]).join('')

/**
 * Base32 解码，忽略空格、连字符、填充符与大小写差异。
 *
 * 不足 8 位的尾部比特直接丢弃，与编码侧的补位规则对应。
 * @param input Base32 字符串
 */
export const decodeBase32 = (input: string): Buffer => {
  const bits = [...input.toUpperCase().replace(/[\s-]/g, '').replace(/=+$/, '')]
    .map((char) => {
      const index = BASE32_ALPHABET.indexOf(char)
      if (index === -1) {
        throw new Error(`invalid base32 character: ${char}`)
      }
      return index.toString(2).padStart(5, '0')
    })
    .join('')
  return Buffer.from((bits.match(/.{8}/g) ?? []).map((byte) => parseInt(byte, 2)))
}

/** 生成 TOTP 密钥（32 位 Base32 字符串，160 位熵），可直接写入 otpauth URI */
export const generateTotpSecret = (): string => randomBase32(32)

/**
 * 按 HOTP 算法计算指定计数器的验证码（RFC 4226）
 * @param secret Base32 密钥
 * @param counter 计数器
 * @param digits 验证码位数
 */
const hotp = (secret: string, counter: number, digits: number): string => {
  const counterBuffer = Buffer.alloc(8)
  counterBuffer.writeBigUInt64BE(BigInt(counter))
  const digest = hmacSha1(decodeBase32(secret), counterBuffer)
  // 动态截断：取摘要最后一个字节的低 4 位作为偏移量，再截取 4 字节并抹掉最高位
  const offset = digest[digest.length - 1]! & 0x0f
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    (digest[offset + 1]! << 16) |
    (digest[offset + 2]! << 8) |
    digest[offset + 3]!
  return (binary % 10 ** digits).toString().padStart(digits, '0')
}

/**
 * 生成当前时间对应的 TOTP 验证码
 * @param secret Base32 密钥
 */
export const generateTotp = (secret: string, options: Omit<TotpOptions, 'window'> = {}): string => {
  const { timestamp = Date.now(), digits = DIGITS } = options
  return hotp(secret, Math.floor(timestamp / 1000 / STEP), digits)
}

/**
 * 校验 TOTP 验证码并返回命中的时间步长，未命中返回 undefined。
 *
 * 返回步长而非布尔值，调用方才能记录已使用的步长以实现防重放。
 * @param secret Base32 密钥
 * @param token 用户输入的验证码
 */
export const verifyTotpCounter = (
  secret: string,
  token: string,
  options: TotpOptions = {},
): number | undefined => {
  const { window = 1, timestamp = Date.now(), digits = DIGITS } = options
  const code = token.trim()
  if (code.length !== digits || !/^\d+$/.test(code)) {
    return undefined
  }
  const counter = Math.floor(timestamp / 1000 / STEP)
  for (let offset = -window; offset <= window; offset++) {
    if (hotp(secret, counter + offset, digits) === code) {
      return counter + offset
    }
  }
  return undefined
}

/**
 * 校验 TOTP 验证码，允许前后 `window` 个时间步长以容忍时钟偏差。
 * 需要防重放时请改用 `verifyTotpCounter` 获取命中的步长。
 * @param secret Base32 密钥
 * @param token 用户输入的验证码
 */
export const verifyTotp = (secret: string, token: string, options: TotpOptions = {}): boolean =>
  verifyTotpCounter(secret, token, options) !== undefined

/**
 * 构造验证器 App 可识别的 otpauth URI
 * @param params.secret Base32 密钥
 * @param params.account 账号标识，一般用邮箱或用户名
 * @param params.issuer 签发者名称，会展示在验证器 App 中
 */
export const buildTotpUri = (params: {
  secret: string
  account: string
  issuer: string
}): string => {
  const { secret, account, issuer } = params
  const label = encodeURIComponent(`${issuer}:${account}`)
  const query = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP),
  })
  return `otpauth://totp/${label}?${query.toString()}`
}
