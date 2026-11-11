import { config } from '@/common/config'
import { log } from '@/common/log'
import { generateNumericCode } from '@/common/utils/crypto'
import { createVerificationCodeStore } from '@/system/utils/verification-code'

const codeStore = createVerificationCodeStore('sms:code:')

export abstract class SmsService {
  static KEY_PREFIX = codeStore.keyPrefix

  static sendCode = async (phone: string) => {
    // const codeLength = Math.max(4, Math.min(6, config.sms.codeLen))
    // const ttl = Math.max(60, config.mail.codeTtl)
    const codeLength = 6
    const ttl = 60

    const code = generateNumericCode(codeLength)
    // 调用短信发送，等待后续实现
    // await sendSms(
    //   phone,
    //   `您的验证码为 ${code}，有效期为 ${(ttl / 60).toFixed(0)} 分钟`,
    //   '如果您没有请求此验证，请忽略此邮件',
    // )
    await codeStore.save(phone, code, ttl)
    // 短信通道未接入时，仅开发环境输出验证码方便调试；生产环境禁止输出明文验证码
    if (config.mode === 'development') {
      log.debug(`[sms] send code for ${phone}: ${code}`)
    }
  }

  static verifyCode = codeStore.verifyCode

  static verifyCodeAutoDelete = codeStore.verifyCodeAutoDelete

  static deleteCode = codeStore.deleteCode
}
