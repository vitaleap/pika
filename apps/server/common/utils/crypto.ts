import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
} from 'node:crypto'

/**
 * 业务无关的密码学原语，按「摘要 / MAC → 对称加解密 → 口令哈希 → 随机数」分区。
 *
 * 统一走 `node:crypto`（Bun 下即 BoringSSL 原生绑定，不要为“更 Bun”换成
 * `Bun.CryptoHasher` / `crypto.subtle`）；仅口令哈希使用 `Bun.password`。
 */

// ──────────────────── 摘要 / MAC ───────────────────────────────────────────

/** md5 摘要，仅用于缓存 key、头像文件名等非安全场景，不可用于密码或签名 */
export function md5(str: string): string {
  const buffer = Buffer.from(str)
  const hash = createHash('md5')
  hash.update(buffer)
  return hash.digest('hex')
}

/** SHA-256 摘要，用于恢复码等敏感值的不可逆存储；低熵输入需自行加盐 */
export function sha256(str: string): string {
  return createHash('sha256').update(str).digest('hex')
}

/** HMAC-SHA1，TOTP（RFC 6238）协议固定使用该算法，新场景请改用 SHA-256 */
export function hmacSha1(key: Buffer, data: Buffer): Buffer {
  return createHmac('sha1', key).update(data).digest()
}

// ──────────────────── 对称加解密 ───────────────────────────────────────────

/** 由任意长度的密钥派生 32 字节 AES 密钥 */
const deriveKey = (secret: string): Buffer => createHash('sha256').update(secret).digest()

/**
 * AES-256-GCM 加密，返回 `iv:authTag:cipher` 的 base64 组合串。
 *
 * 随机 iv 使同一明文每次结果不同，不能用于等值查询；密钥经 SHA-256 派生，
 * 只适用于高熵配置密钥（用户口令须改用 scrypt / PBKDF2 加盐派生）。
 */
export function encryptText(plain: string, secret: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', deriveKey(secret), iv)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), encrypted].map((item) => item.toString('base64')).join(':')
}

/** 解密 `encryptText` 的密文，密钥不匹配或密文被篡改时抛错（GCM 认证失败） */
export function decryptText(payload: string, secret: string): string {
  const [iv, authTag, encrypted] = payload.split(':')
  // 用 === undefined 而非取反，否则空明文的密文段为空字符串时无法往返
  if (!iv || !authTag || encrypted === undefined) {
    throw new Error('invalid encrypted payload')
  }
  const decipher = createDecipheriv('aes-256-gcm', deriveKey(secret), Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(authTag, 'base64'))
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}

// ──────────────────── 口令哈希 ─────────────────────────────────────────────

/** 哈希密码（argon2id，salt 自动生成），密码存储一律走这里，不要用 md5 / sha256 */
export async function hashPassword(pwd: string): Promise<string> {
  return await Bun.password.hash(pwd)
}

/** 校验密码，`hash` 非法时会抛错而非返回 false，必须是 `hashPassword` 的产出 */
export async function verifyPassword(pwd: string, hash: string): Promise<boolean> {
  return await Bun.password.verify(pwd, hash)
}

// ──────────────────── 随机数 ───────────────────────────────────────────────

/** 生成指定长度的数字验证码（CSPRNG，不可替换为 Math.random） */
export function generateNumericCode(length: number): string {
  return randomInt(0, 10 ** length)
    .toString()
    .padStart(length, '0')
}
