import { z } from 'zod'
import { t } from '@/common/plugins/i18n'
import { isPassword } from '@pika/shared'

/** 邮箱最大长度，与 `user.email` 字段的 varchar(50) 对齐 */
export const EMAIL_MAX_LENGTH = 50

/**
 * 邮箱本地部分（`@` 前）：仅字母数字与 `_ -`，允许用点分段，但不得首尾或连续出现点。
 * 同时禁掉 `+` 等子地址派生写法（如 `name+随机串@gmail.com`），避免无限注册
 */
const EMAIL_LOCAL_PART_PATTERN = /^[a-zA-Z\d_-]+(?:\.[a-zA-Z\d_-]+)*$/

/**
 * 邮箱规则：合法邮箱、字符集受限且不超过 {@link EMAIL_MAX_LENGTH} 字符。
 * 字符集不合法时统一报格式错误，不暴露具体规则，避免被用于探测校验策略。
 */
export const createEmailSchema = (invalidMessage: string = t('SYSTEM.EMAIL_INVALID')) =>
  z
    .email(invalidMessage)
    .max(EMAIL_MAX_LENGTH, t('SYSTEM.EMAIL_MAX_LENGTH', { max: EMAIL_MAX_LENGTH }))
    .refine((value) => EMAIL_LOCAL_PART_PATTERN.test(value.split('@')[0]!), invalidMessage)

/** 通用邮箱校验，与 `user.email` 字段长度保持一致 */
export const emailSchema = createEmailSchema()

/** 密码规则：6-30 位，仅允许字母数字与常见符号，且必须同时包含字母和数字 */
export const passwordSchema = z
  .string()
  .min(6, t('SYSTEM.PASSWORD_MIN_LENGTH', { min: 6 }))
  .max(30, t('SYSTEM.PASSWORD_MAX_LENGTH', { max: 30 }))
  .refine((v) => isPassword(v), t('SYSTEM.PASSWORD_FORMAT_INVALID'))
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), t('SYSTEM.PASSWORD_LETTER_NUMBER_REQUIRED'))
