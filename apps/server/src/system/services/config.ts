import { z } from 'zod'
import { ConfigRepository, mergeConfig, type AppConfig } from '@/system/repositories/config'
import { cache } from '@/common/cache'
import { t } from '@/common/plugins/i18n'
import { HttpError } from '@pika/elysia-plugins'

/** 配置缓存键 */
const CACHE_KEY = 'system:config'
/** 配置缓存有效期 */
const CACHE_TTL = '300s'

const authConfigSchema = z.object({
  regEnabled: z.boolean(),
  loginTypes: z.array(z.enum(['password', 'phone_code', 'email_code'])),
  regType: z.enum(['email', 'phone']).default('email'),
})
const authUpdateSchema = authConfigSchema.partial()

const mailConfigSchema = z.discriminatedUnion('enabled', [
  z.object({ enabled: z.literal(false) }),
  z.object({
    enabled: z.literal(true),
    codeLen: z.number().int().min(4).max(8),
    codeTtl: z.number().int().min(60).max(3600),
    host: z.string().min(1, t('SYSTEM.SMTP_HOST_REQUIRED')),
    port: z.number().int().min(1).max(65535),
    ssl: z.boolean(),
    user: z.string().min(1, t('SYSTEM.SMTP_USER_REQUIRED')),
    pass: z.string().min(1, t('SYSTEM.SMTP_PASS_REQUIRED')),
    senderName: z.string().min(1),
  }),
])
const mailUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  codeLen: z.number().int().min(4).max(8).optional(),
  codeTtl: z.number().int().min(60).max(3600).optional(),
  host: z.string().min(1, t('SYSTEM.SMTP_HOST_REQUIRED')).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  ssl: z.boolean().optional(),
  user: z.string().min(1, t('SYSTEM.SMTP_USER_REQUIRED')).optional(),
  pass: z.string().min(1, t('SYSTEM.SMTP_PASS_REQUIRED')).optional(),
  senderName: z.string().min(1).optional(),
})

const fileConfigSchema = z.discriminatedUnion('ossEnabled', [
  z.object({
    maxSize: z.number().int().min(1024),
    allowedTypes: z.array(z.string()),
    disabledTypes: z.array(z.string()),
    ossEnabled: z.literal(false),
  }),
  z.object({
    maxSize: z.number().int().min(1024),
    allowedTypes: z.array(z.string()),
    disabledTypes: z.array(z.string()),
    ossEnabled: z.literal(true),
    ossEndpoint: z.url(t('SYSTEM.OSS_ENDPOINT_INVALID')),
    ossBucket: z.string().min(1, t('SYSTEM.OSS_BUCKET_REQUIRED')),
    ossAccessKeyId: z.string().min(1, t('SYSTEM.OSS_ACCESS_KEY_ID_REQUIRED')),
    ossSecretAccessKey: z.string().min(1, t('SYSTEM.OSS_SECRET_ACCESS_KEY_REQUIRED')),
    ossRegion: z.string().min(1, t('SYSTEM.OSS_REGION_REQUIRED')),
    ossForcePathStyle: z.boolean(),
    ossDefaultUrlExpiresIn: z.number().int().min(60).max(86400),
    ossHideFileUrl: z.boolean(),
  }),
])
const fileUpdateSchema = z.object({
  maxSize: z.number().int().min(1024).optional(),
  allowedTypes: z.array(z.string()).optional(),
  disabledTypes: z.array(z.string()).optional(),
  ossEnabled: z.boolean().optional(),
  ossEndpoint: z.url(t('SYSTEM.OSS_ENDPOINT_INVALID')).optional(),
  ossBucket: z.string().min(1, t('SYSTEM.OSS_BUCKET_REQUIRED')).optional(),
  ossAccessKeyId: z.string().min(1, t('SYSTEM.OSS_ACCESS_KEY_ID_REQUIRED')).optional(),
  ossSecretAccessKey: z.string().min(1, t('SYSTEM.OSS_SECRET_ACCESS_KEY_REQUIRED')).optional(),
  ossRegion: z.string().min(1, t('SYSTEM.OSS_REGION_REQUIRED')).optional(),
  ossForcePathStyle: z.boolean().optional(),
  ossDefaultUrlExpiresIn: z.number().int().min(60).max(86400).optional(),
  ossHideFileUrl: z.boolean().optional(),
})

const updateBodySchema = z.object({
  auth: authUpdateSchema.optional(),
  mail: mailUpdateSchema.optional(),
  file: fileUpdateSchema.optional(),
})

const configRespSchema = z.object({
  id: z.string(),
  auth: authConfigSchema,
  mail: mailConfigSchema,
  file: fileConfigSchema,
})

export abstract class ConfigService {
  static GetRespSchema = configRespSchema

  static UpdateBodySchema = updateBodySchema

  static UpdateRespSchema = configRespSchema

  static ResetRespSchema = configRespSchema

  /** 清除配置缓存（写入配置后调用） */
  static clearCache = () => cache.del(CACHE_KEY)

  static get = async (): Promise<z.infer<typeof ConfigService.GetRespSchema>> => {
    const data = await cache.getOrSet(CACHE_KEY, () => ConfigRepository.get(), CACHE_TTL)
    return ConfigService.GetRespSchema.parse(data)
  }

  static update = async (
    body: z.infer<typeof ConfigService.UpdateBodySchema>,
  ): Promise<z.infer<typeof ConfigService.UpdateRespSchema>> => {
    if (Object.keys(body).length === 0) {
      throw new HttpError(t('SYSTEM.CONFIG_UPDATE_REQUIRED'), 400)
    }
    // 校验通过后再写入，避免落库一份连读取都无法通过校验的配置。
    const patch = body as Partial<AppConfig>
    const current = await ConfigRepository.get()
    const merged = ConfigService.UpdateRespSchema.safeParse(mergeConfig(current, patch))
    if (!merged.success) {
      const issue = merged.error.issues[0]!
      throw new HttpError(issue.message, 422, issue.path.join('.'))
    }
    await ConfigRepository.update(patch)
    await ConfigService.clearCache()
    return ConfigService.get()
  }

  static reset = async (): Promise<z.infer<typeof ConfigService.ResetRespSchema>> => {
    await ConfigRepository.update({
      auth: {
        regEnabled: true,
        loginTypes: ['password'],
        regType: 'email',
      },
      mail: { enabled: false },
      file: {
        maxSize: 20 * 1024 * 1024,
        allowedTypes: [],
        disabledTypes: [],
        ossEnabled: false,
      },
    })
    await ConfigService.clearCache()
    return ConfigService.get()
  }
}
