import { cache } from '@/common/cache'
import { t } from '@/common/plugins/i18n'
import { HttpError } from '@pika/elysia-plugins'

/**
 * 基于 cache 的验证码存储，按渠道（邮箱 / 短信）前缀隔离。
 *
 * 两个渠道的校验逻辑完全一致，仅缓存 key 前缀不同。
 */
export const createVerificationCodeStore = (keyPrefix: string) => {
  const keyOf = (target: string) => `${keyPrefix}${target}`

  const deleteCode = async (target: string): Promise<void> => {
    await cache.del(keyOf(target))
  }

  /**
   * 校验验证码并按需删除缓存。
   *
   * 1. 验证码登录场景：验证通过后直接登录，删除缓存即可
   * 2. 修改邮箱 / 手机号场景：先验证，再写数据库；此时因其他原因导致的失败不应删除缓存，
   *    否则用户需要重新发送验证码
   */
  const verifyCodeAutoDelete = async (
    target: string,
    code: string,
    autoDelete: boolean,
  ): Promise<void> => {
    const cachedCode = await cache.get<string>(keyOf(target))
    if (!cachedCode) {
      throw new HttpError(t('SYSTEM.VERIFICATION_CODE_EXPIRED'))
    }
    if (cachedCode !== code) {
      throw new HttpError(t('SYSTEM.VERIFICATION_CODE_INCORRECT'))
    }
    if (autoDelete) {
      await deleteCode(target)
    }
  }

  return {
    keyPrefix,
    save: async (target: string, code: string, ttlSeconds: number): Promise<void> => {
      await cache.set(keyOf(target), code, ttlSeconds)
    },
    verifyCode: async (target: string, code: string): Promise<void> => {
      await verifyCodeAutoDelete(target, code, true)
    },
    verifyCodeAutoDelete,
    deleteCode,
  }
}
