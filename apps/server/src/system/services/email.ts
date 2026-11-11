import { ConfigService } from '@/system/services/config'
import { sendMail } from '@/common/email'
import { log } from '@/common/log'
import { generateNumericCode } from '@/common/utils/crypto'
import { createVerificationCodeStore } from '@/system/utils/verification-code'

const codeStore = createVerificationCodeStore('email:code:')

export abstract class EmailService {
  static KEY_PREFIX = codeStore.keyPrefix

  /**
   * 发送验证码
   * @param email 接收验证码的邮箱
   */
  static sendCode = async (email: string) => {
    const { mail } = await ConfigService.get()
    const codeLength = mail.enabled ? mail.codeLen : 4
    const code = generateNumericCode(codeLength)
    // 至少60秒
    const ttl = Math.max(60, mail.enabled ? mail.codeTtl : 300)
    // 调用邮箱发送
    await sendMail(
      email,
      '邮箱验证码',
      `您的验证码为 ${code}，有效期为 ${(ttl / 60).toFixed(0)} 分钟`,
      '如果您没有请求此验证，请忽略此邮件',
    )
    await codeStore.save(email, code, ttl)
    // mail 未启用时输出验证码到日志，方便调试
    if (!mail.enabled) {
      log.info(`[email] send code for ${email}: ${code}`)
    }
  }

  static verifyCode = codeStore.verifyCode

  static verifyCodeAutoDelete = codeStore.verifyCodeAutoDelete

  static deleteCode = codeStore.deleteCode
}
