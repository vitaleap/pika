import { createHash, randomInt } from 'node:crypto'

/**
 * md5加密
 * @param str 明文
 * @returns 密文
 */
export function md5(str: string): string {
  const buffer = Buffer.from(str)
  const hash = createHash('md5')
  hash.update(buffer)
  return hash.digest('hex')
}

/**
 * 哈希密码（使用 bcrypt）
 * @param pwd 明文密码
 * @returns bcrypt 哈希值
 */
export async function hashPassword(pwd: string): Promise<string> {
  return await Bun.password.hash(pwd)
}

/**
 * 验证密码（使用 bcrypt）
 * @param pwd 明文密码
 * @param hash 已存储的哈希值
 * @returns 是否匹配
 */
export async function verifyPassword(pwd: string, hash: string): Promise<boolean> {
  return await Bun.password.verify(pwd, hash)
}

/**
 * 生成指定长度的数字验证码（使用加密安全随机数）
 * @param length 验证码长度
 * @returns 补零后的数字字符串
 */
export function generateNumericCode(length: number): string {
  return randomInt(0, 10 ** length)
    .toString()
    .padStart(length, '0')
}
