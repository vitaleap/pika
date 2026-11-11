const NICKNAME_PATTERN = /^(?!_)[\u4e00-\u9fa5a-zA-Z0-9_]{2,}(?<!_)$/
const PASSWORD_PATTERN = /^[a-zA-Z\d!@#$%^&*()_+=.\-?]{6,30}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// 中国大陆手机号：1 开头，第二位 3-9，共 11 位
export const PHONE_PATTERN = /^1[3-9]\d{9}$/

/**
 * 昵称合法校验，只能包含中文字母数字下划线
 * @param str 字符串
 * @returns bool
 */
export const isNickname = (value: string | undefined): boolean =>
  value !== undefined && NICKNAME_PATTERN.test(value)

/**
 * 密码合法校验，只能包含字母数字符号
 * @param str 字符串
 * @returns bool
 */
export const isPassword = (value: string | undefined): boolean =>
  value !== undefined && PASSWORD_PATTERN.test(value)

/**
 * 邮箱合法校验
 * @param str 字符串
 * @returns bool
 */
export const isEmail = (value: string | undefined): boolean =>
  value !== undefined && EMAIL_PATTERN.test(value)

/**
 * 手机号合法校验（中国大陆 11 位手机号）
 * @param value 字符串
 * @returns bool
 */
export const isPhone = (value: string | undefined): boolean =>
  value !== undefined && PHONE_PATTERN.test(value)

const VALIDATE_EMAIL = ['gmail.com', 'qq.com', '163.com', '126.com', 'outlook.com', 'icloud.com']

/**
 * 验证邮箱是否合法，且在允许的域名列表中
 * @param email 邮箱
 * @returns result: { isEmail: boolean, isValidDomain: boolean }
 */
export const validateEmail = (email: string): { isEmail: boolean; isValidDomain: boolean } => {
  if (!isEmail(email)) {
    return {
      isEmail: false,
      isValidDomain: false,
    }
  }
  const domain = email.split('@')[1]
  const isValidDomain = VALIDATE_EMAIL.includes(domain ?? '')
  return {
    isEmail: true,
    isValidDomain,
  }
}
