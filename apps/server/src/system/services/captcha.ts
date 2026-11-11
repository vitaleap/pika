import { generateSlideCaptcha, validateSlideCaptcha } from '@seepine/captcha'
import type { Block } from '@seepine/captcha'
import {
  bg1,
  bg2,
  bg3,
  bg4,
  tile1Mask,
  tile1Shadow,
  tile1Overlay,
  tile2Mask,
  tile2Shadow,
  tile2Overlay,
  tile3Mask,
  tile3Shadow,
  tile3Overlay,
} from '@seepine/captcha/assets'
import { z } from 'zod'
import { cache } from '@/common/cache'
import { t } from '@/common/plugins/i18n'
import { snowflake } from '@/common/snowflake'
import { HttpError } from '@pika/elysia-plugins'

/** 内置背景图与拼图素材池，每次生成随机选取 */
const slideCaptchaResources = {
  backgrounds: [bg1, bg2, bg3, bg4],
  graphImages: [
    { maskImage: tile1Mask, shadowImage: tile1Shadow, overlayImage: tile1Overlay },
    { maskImage: tile2Mask, shadowImage: tile2Shadow, overlayImage: tile2Overlay },
    { maskImage: tile3Mask, shadowImage: tile3Shadow, overlayImage: tile3Overlay },
  ],
}

export abstract class CaptchaService {
  static CaptchaGenRespSchema = z.object({
    uniqueId: z.string().min(1, t('SYSTEM.UNIQUE_ID_REQUIRED')),
    thumbWidth: z.number().min(1, t('SYSTEM.CAPTCHA_THUMB_WIDTH_REQUIRED')),
    thumbHeight: z.number().min(1, t('SYSTEM.CAPTCHA_THUMB_HEIGHT_REQUIRED')),
    thumbX: z.number().min(1, t('SYSTEM.CAPTCHA_THUMB_X_REQUIRED')),
    thumbY: z.number().min(1, t('SYSTEM.CAPTCHA_THUMB_Y_REQUIRED')),
    image: z.string().min(1, t('SYSTEM.CAPTCHA_IMAGE_REQUIRED')),
    thumb: z.string().min(1, t('SYSTEM.CAPTCHA_THUMB_REQUIRED')),
  })

  static captchaGen = async (): Promise<z.infer<typeof CaptchaService.CaptchaGenRespSchema>> => {
    const { masterImage, tileImage, block } = await generateSlideCaptcha({
      resources: slideCaptchaResources,
    })

    const uniqueId = snowflake.nextId()
    // 缓存 block 用于后续校验，过期时间 5 分钟
    await cache.set(`captcha:${uniqueId}`, block, 5 * 60)

    return {
      uniqueId,
      thumbWidth: block.width,
      thumbHeight: block.height,
      thumbX: block.dx,
      thumbY: block.dy,
      image: `data:image/jpeg;base64,${masterImage.toString('base64')}`,
      thumb: `data:image/png;base64,${tileImage.toString('base64')}`,
    }
  }

  static CaptchaVerifySchema = z.object({
    uniqueId: z.string().min(1, t('SYSTEM.UNIQUE_ID_REQUIRED')),
    x: z.number().min(0, t('SYSTEM.CAPTCHA_X_INVALID')),
    y: z.number().min(0, t('SYSTEM.CAPTCHA_Y_INVALID')),
  })

  static CaptchaVerifyRespSchema = z.object({
    success: z.boolean(),
  })

  static captchaVerify = async (params: z.infer<typeof CaptchaService.CaptchaVerifySchema>) => {
    const key = `captcha:${params.uniqueId}`
    const block = await cache.get<Block>(key)
    // 无论正确或失败都删除验证码缓存，避免被碰撞
    await cache.del(key)
    if (!block) {
      throw new HttpError(t('SYSTEM.CAPTCHA_EXPIRED_OR_NOT_FOUND'))
    }
    if (!validateSlideCaptcha(block, params.x, params.y)) {
      return false
    }
    // 验证成功后设置 uniqueId 为验证成功，过期时间为10分钟
    await cache.set(`captcha:${params.uniqueId}:success`, true, 10 * 60)
    return true
  }

  /** 校验验证码是否已通过；未通过时直接抛错，通过后立即删除缓存（一次性） */
  static captchaVerifySuccess = async (uniqueId: string): Promise<void> => {
    const key = `captcha:${uniqueId}:success`
    const success = await cache.get<boolean>(key)
    if (!success) {
      throw new HttpError(t('SYSTEM.CAPTCHA_EXPIRED'))
    }
    await cache.del(key)
  }
}
