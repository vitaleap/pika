import { z } from 'zod'
import { t } from '@/common/plugins/i18n'
import { isPassword } from '@pika/shared'

/** 密码规则：6-30 位，仅允许字母数字与常见符号，且必须同时包含字母和数字 */
export const passwordSchema = z
  .string()
  .min(6, t('SYSTEM.PASSWORD_MIN_LENGTH', { min: 6 }))
  .max(30, t('SYSTEM.PASSWORD_MAX_LENGTH', { max: 30 }))
  .refine((v) => isPassword(v), t('SYSTEM.PASSWORD_FORMAT_INVALID'))
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), t('SYSTEM.PASSWORD_LETTER_NUMBER_REQUIRED'))

/** 可选的密码字段，未提供时跳过全部校验 */
export const optionalPasswordSchema = passwordSchema.optional()
