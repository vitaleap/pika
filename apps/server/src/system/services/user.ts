import { z } from 'zod'
import { cache } from '@/common/cache'
import { t } from '@/common/plugins/i18n'
import { UserRepository } from '@/system/repositories/user'
import { EmailService } from '@/system/services/email'
import { SmsService } from '@/system/services/sms'
import { isNickname, isPhone, validateEmail } from '@pika/shared'
import { optionalPasswordSchema } from '@/system/utils/validation'
import { HttpError } from '@pika/elysia-plugins'
import { hashPassword, verifyPassword } from '@/common/utils/crypto'

const isAvatarUrl = (url: string) => z.url().safeParse(url).success || url.startsWith('/')

const verificationCodeField = (message: string) => z.string().min(4, message).max(8, message)

export abstract class UserService {
  static EditBodySchema = z
    .object({
      name: z
        .string()
        .min(2, t('SYSTEM.NICKNAME_LENGTH_INVALID', { min: 2, max: 20 }))
        .max(20, t('SYSTEM.NICKNAME_LENGTH_INVALID', { min: 2, max: 20 }))
        .optional()
        .refine((val) => !val || isNickname(val), t('SYSTEM.NICKNAME_FORMAT_INVALID')),
      password: optionalPasswordSchema,
      newPassword: optionalPasswordSchema,
      picture: z
        .string()
        .max(500, t('SYSTEM.AVATAR_URL_TOO_LONG'))
        .refine(isAvatarUrl, t('SYSTEM.AVATAR_URL_INVALID'))
        .optional(),
    })
    .refine((data) => Boolean(data.password) === Boolean(data.newPassword), {
      message: t('SYSTEM.PASSWORD_CHANGE_FIELDS_REQUIRED'),
      path: ['newPassword'],
    })

  static EditRespSchema = z.object({
    id: z.string(),
    name: z.string(),
    picture: z.string().optional(),
  })

  static edit = async (userId: string, body: z.infer<typeof UserService.EditBodySchema>) => {
    const user = await UserRepository.findById(userId)
    if (!user) {
      throw new HttpError(t('SYSTEM.USER_NOT_FOUND'), 404)
    }

    const updateData: Parameters<typeof UserRepository.updateById>[1] = {}

    if (body.name) {
      updateData.name = body.name
    }

    if (body.picture !== undefined) {
      updateData.picture = body.picture
    }

    if (body.password && body.password === body.newPassword) {
      throw new HttpError(t('SYSTEM.NEW_PASSWORD_SAME_AS_OLD'))
    }
    if (body.password && body.newPassword) {
      if (!user.password || !(await verifyPassword(body.password, user.password))) {
        throw new HttpError(t('SYSTEM.OLD_PASSWORD_INCORRECT'))
      }
      updateData.password = await hashPassword(body.newPassword)
    }
    if (Object.keys(updateData).length > 0) {
      await UserRepository.updateById(userId, updateData)
    }

    return {
      id: user.id,
      name: updateData.name || user.name,
      picture: updateData.picture || user.picture || undefined,
    }
  }

  static EditEmailBodySchema = z.object({
    // 账号未绑定邮箱时无需提供旧邮箱与旧验证码
    oldEmail: z.email(t('SYSTEM.OLD_EMAIL_INVALID')).optional(),
    newEmail: z.email(t('SYSTEM.NEW_EMAIL_INVALID')),
    oldCode: verificationCodeField(
      t('SYSTEM.OLD_EMAIL_VERIFICATION_CODE_LENGTH_INVALID', { min: 4, max: 8 }),
    ).optional(),
    newCode: verificationCodeField(
      t('SYSTEM.NEW_EMAIL_VERIFICATION_CODE_LENGTH_INVALID', { min: 4, max: 8 }),
    ),
  })

  static EditEmailRespSchema = z.object({
    success: z.boolean(),
  })

  static editEmail = async (
    userId: string,
    body: z.infer<typeof UserService.EditEmailBodySchema>,
  ): Promise<z.infer<typeof UserService.EditEmailRespSchema>> => {
    const newEmail = body.newEmail.toLowerCase().trim()
    const oldEmail = body.oldEmail?.toLowerCase().trim() ?? ''
    const oldCode = body.oldCode ?? ''
    const user = await UserRepository.findById(userId)
    if (!user) {
      throw new HttpError(t('SYSTEM.USER_NOT_FOUND'), 404)
    }

    const currentEmail = user.email?.toLowerCase().trim() ?? ''
    if (currentEmail) {
      // 已绑定邮箱：必须校验旧邮箱及其验证码
      if (!oldEmail || !oldCode) {
        throw new HttpError(t('SYSTEM.OLD_EMAIL_VERIFICATION_REQUIRED'), 400)
      }
      if (currentEmail !== oldEmail) {
        throw new HttpError(t('SYSTEM.OLD_EMAIL_INCORRECT'))
      }
      if (newEmail === oldEmail) {
        throw new HttpError(t('SYSTEM.NEW_EMAIL_SAME_AS_CURRENT'))
      }
    }

    const validateResult = validateEmail(newEmail)
    if (validateResult.isEmail === false) {
      throw new HttpError(t('SYSTEM.EMAIL_INVALID'), 400)
    }
    if (validateResult.isValidDomain === false) {
      throw new HttpError(t('SYSTEM.EMAIL_DOMAIN_UNSUPPORTED'), 400)
    }

    return cache.lock(`user:${userId}:email`, () => {
      // 同时锁定新邮箱，避免与注册流程并发冲突。
      return cache.lock(newEmail, async () => {
        const existing = await UserRepository.findByEmail(newEmail)
        if (existing) {
          throw new HttpError(t('SYSTEM.EMAIL_ALREADY_EXISTS'), 409)
        }

        if (currentEmail) {
          await EmailService.verifyCodeAutoDelete(oldEmail, oldCode, false)
        }
        await EmailService.verifyCodeAutoDelete(newEmail, body.newCode, false)
        await UserRepository.updateById(userId, { email: newEmail, emailVerified: true })
        await cache.del(userId)
        if (currentEmail) {
          await EmailService.deleteCode(oldEmail)
        }
        await EmailService.deleteCode(newEmail)

        return {
          success: true,
        }
      })
    })
  }

  static EditPhoneBodySchema = z.object({
    // 账号未绑定手机号时无需提供旧手机号与旧验证码
    oldPhone: z
      .string()
      .min(1, t('SYSTEM.PHONE_REQUIRED'))
      .refine(isPhone, t('SYSTEM.OLD_PHONE_INVALID'))
      .optional(),
    newPhone: z
      .string()
      .min(1, t('SYSTEM.PHONE_REQUIRED'))
      .refine(isPhone, t('SYSTEM.NEW_PHONE_INVALID')),
    oldCode: verificationCodeField(
      t('SYSTEM.OLD_PHONE_VERIFICATION_CODE_LENGTH_INVALID', { min: 4, max: 8 }),
    ).optional(),
    newCode: verificationCodeField(
      t('SYSTEM.NEW_PHONE_VERIFICATION_CODE_LENGTH_INVALID', { min: 4, max: 8 }),
    ),
  })

  static EditPhoneRespSchema = z.object({
    success: z.boolean(),
  })

  static editPhone = async (
    userId: string,
    body: z.infer<typeof UserService.EditPhoneBodySchema>,
  ): Promise<z.infer<typeof UserService.EditPhoneRespSchema>> => {
    const newPhone = body.newPhone
    const oldPhone = body.oldPhone ?? ''
    const oldCode = body.oldCode ?? ''
    const user = await UserRepository.findById(userId)
    if (!user) {
      throw new HttpError(t('SYSTEM.USER_NOT_FOUND'), 404)
    }

    const currentPhone = user.phoneNumber ?? ''
    if (currentPhone) {
      // 已绑定手机号：必须校验旧手机号及其验证码
      if (!oldPhone || !oldCode) {
        throw new HttpError(t('SYSTEM.OLD_PHONE_VERIFICATION_REQUIRED'), 400)
      }
      if (currentPhone !== oldPhone) {
        throw new HttpError(t('SYSTEM.OLD_PHONE_INCORRECT'))
      }
      if (newPhone === oldPhone) {
        throw new HttpError(t('SYSTEM.NEW_PHONE_SAME_AS_CURRENT'))
      }
    }

    return cache.lock(`user:${userId}:phone`, () => {
      // 同时锁定新手机号，避免与注册流程并发冲突。
      return cache.lock(newPhone, async () => {
        const existing = await UserRepository.findByPhone(newPhone)
        if (existing) {
          throw new HttpError(t('SYSTEM.PHONE_ALREADY_EXISTS'), 409)
        }

        if (currentPhone) {
          await SmsService.verifyCodeAutoDelete(oldPhone, oldCode, false)
        }
        await SmsService.verifyCodeAutoDelete(newPhone, body.newCode, false)
        await UserRepository.updateById(userId, {
          phoneNumber: newPhone,
          phoneNumberVerified: true,
        })
        await cache.del(userId)
        if (currentPhone) {
          await SmsService.deleteCode(oldPhone)
        }
        await SmsService.deleteCode(newPhone)

        return {
          success: true,
        }
      })
    })
  }

  static CheckEmailBodySchema = z.object({
    email: z.email(t('SYSTEM.EMAIL_INVALID')),
  })

  static CheckEmailRespSchema = z.object({ available: z.boolean() })

  static CheckPhoneBodySchema = z.object({
    phone: z.string().min(1, t('SYSTEM.PHONE_REQUIRED')).refine(isPhone, t('SYSTEM.PHONE_INVALID')),
  })

  static CheckPhoneRespSchema = z.object({ available: z.boolean() })

  /** 邮箱是否可被当前用户使用（排除自身，用于修改前验重） */
  static checkEmail = async (
    userId: string,
    body: z.infer<typeof UserService.CheckEmailBodySchema>,
  ): Promise<z.infer<typeof UserService.CheckEmailRespSchema>> => {
    const existing = await UserRepository.findByEmail(body.email.toLowerCase().trim())
    return { available: !existing || existing.id === userId }
  }

  /** 手机号是否可被当前用户使用（排除自身，用于修改前验重） */
  static checkPhone = async (
    userId: string,
    body: z.infer<typeof UserService.CheckPhoneBodySchema>,
  ): Promise<z.infer<typeof UserService.CheckPhoneRespSchema>> => {
    const existing = await UserRepository.findByPhone(body.phone)
    return { available: !existing || existing.id === userId }
  }
}
