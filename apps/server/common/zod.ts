import dayjs from 'dayjs'
import { z } from 'zod'
import { t } from '@/common/plugins/i18n'

/**
 * 代替默认的 z.boolean()，用于接收 query 参数中的字符串布尔值
 */
export const zodBoolean = () =>
  z.union([z.boolean(), z.stringbool()]) as unknown as z.ZodType<boolean, boolean>

export const zodDayjs = () => {
  return z.preprocess(
    (val) => {
      if (typeof val === 'object' && dayjs.isDayjs(val)) {
        return val.toISOString()
      }
      // 2026-05-05T15:59:37.333Z
      // 2026-05-05 15:59:37
      if (typeof val === 'string' && (val.length === 24 || val.length === 19)) {
        return val
      }
      // 其他情况返回空字符串，触发后续的验证错误
      return ''
    },
    z
      .string()
      .refine((val) => dayjs(val).isValid(), {
        message: t('COMMON.DATE_INVALID'),
      })
      .transform((val) => dayjs(val)),
  )
}
