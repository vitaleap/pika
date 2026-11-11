import { z } from 'zod'
import { BACKGROUND_TYPES, MAIN_BG_BLUR_MAX } from '@pika/shared'
import { t } from '@/common/plugins/i18n'
import { UserPreferenceRepository } from '@/system/repositories/user-preference'

const isRgb = (value: string) => {
  const parts = value.split(' ')
  if (parts.length !== 3) {
    return false
  }
  return parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

const themeStyleSchema = z.object({
  sidebarBgColor: z.string().refine(isRgb, t('SYSTEM.SIDEBAR_BG_COLOR_INVALID')),
  sidebarBgTransparency: z
    .string()
    .refine(
      (value) => /^\d(\.\d+)?$/.test(value) && Number(value) <= 1,
      t('SYSTEM.SIDEBAR_BG_TRANSPARENCY_INVALID'),
    ),
  // 空字符串表示未上传自定义背景图
  mainBgImageUrl: z.string().max(500, t('SYSTEM.MAIN_BG_IMAGE_URL_TOO_LONG')),
  mainBgType: z.enum(BACKGROUND_TYPES),
  mainBgBlur: z
    .number()
    .int(t('SYSTEM.MAIN_BG_BLUR_INVALID'))
    .min(0, t('SYSTEM.MAIN_BG_BLUR_INVALID'))
    .max(MAIN_BG_BLUR_MAX, t('SYSTEM.MAIN_BG_BLUR_INVALID')),
})

/** 请求体允许省略 `mainBgType`，由服务端补默认值；响应中该字段必然存在 */
const themeStyleBodySchema = themeStyleSchema.extend({
  mainBgType: z.enum(BACKGROUND_TYPES).default('color'),
})

const appearanceSchema = z.object({
  light: themeStyleSchema,
  dark: themeStyleSchema,
})

const appearanceBodySchema = z.object({
  light: themeStyleBodySchema,
  dark: themeStyleBodySchema,
})

export abstract class UserPreferenceService {
  /** 未保存过时 `appearance` 为 `null`，默认值由客户端补齐，服务端不落库默认值 */
  static GetRespSchema = z.object({ appearance: appearanceSchema.nullable() })

  /** 外观风格整体保存：明亮/暗黑两套需同时提交，提交值会覆盖已存值 */
  static SaveBodySchema = z.object({ appearance: appearanceBodySchema })

  static SaveRespSchema = z.object({ appearance: appearanceSchema })

  static get = async (
    userId: string,
  ): Promise<z.infer<typeof UserPreferenceService.GetRespSchema>> => {
    const row = await UserPreferenceRepository.findByUserId(userId)
    return UserPreferenceService.GetRespSchema.parse({ appearance: row?.appearance ?? null })
  }

  static save = async (
    userId: string,
    body: z.infer<typeof UserPreferenceService.SaveBodySchema>,
  ): Promise<z.infer<typeof UserPreferenceService.SaveRespSchema>> => {
    await UserPreferenceRepository.save(userId, body)
    // 保存值即最终值（`mainBgType` 已由 schema 补默认值），无需再读库
    return { appearance: body.appearance }
  }
}
