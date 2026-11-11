import nodemailer from 'nodemailer'

/**
 * 邮件服务配置；由调用方从业务配置库（如 `ConfigRepository`）注入。
 * 使用可辨识联合，未启用时其他 SMTP 字段可缺失。
 */
export type MailConfig =
  | {
      enabled: false
    }
  | {
      enabled: true
      /** SMTP 主机 */
      host: string
      /** SMTP 端口 */
      port: number
      /** 是否使用 SSL */
      ssl: boolean
      /** SMTP 用户名 */
      user: string
      /** SMTP 密码 */
      pass: string
      /** 发件人显示名 */
      senderName: string
    }

export interface SendMailOptions {
  /** 收件人邮箱 */
  to: string
  /** 邮件主题 */
  subject: string
  /** 邮件正文（纯文本，自动 escape） */
  text: string
  /** 可选的小字提示 */
  tip?: string
}

/**
 * 可选 logger；不传则不输出 warn / error 日志。
 *
 * 签名与 pino `LogFn` 对齐，支持三种调用形态：
 * - 单参字符串：`log.warn('msg')`
 * - 单参对象：`log.error({ err })`
 * - 双参：`log.error({ err }, 'msg')`
 */
export interface MailLogger {
  warn: (obj: object | string, msg?: string) => void
  error: (obj: object | string, msg?: string) => void
}

const escapeHtml = (str: string) =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

/**
 * 发送邮件。
 *
 * 不依赖任何 web 框架或具体配置仓库；调用方按需传入 mailConfig（通常从业务配置库获取）。
 * 框架中立，可在任意 Node / Bun 服务中复用。
 *
 * @example
 * ```ts
 * const { mail } = await ConfigRepository.get()
 * await sendMail(mail, { to, subject, text, tip }, log)
 * ```
 */
export const sendMail = async (
  mailConfig: MailConfig,
  opts: SendMailOptions,
  log?: MailLogger,
): Promise<boolean> => {
  const { to, subject, text, tip } = opts

  if (!mailConfig.enabled) {
    log?.warn(`[email] 邮件服务未启用，无法发送邮件 send mail to ${to} with subject ${subject}`)
    return false
  }

  const transporter = nodemailer.createTransport({
    host: mailConfig.host,
    port: mailConfig.port,
    secure: mailConfig.ssl,
    auth: {
      user: mailConfig.user,
      pass: mailConfig.pass,
    },
  })

  const sendFunc = transporter.sendMail({
    from: `"${mailConfig.senderName}" <${mailConfig.user}>`,
    to,
    subject,
    html: `
    <style>
    * {
      background-color: #f6f6f6;
    }
    div{
      background-color: #ffffff;
    }
    .title {
      color: #020202;
      font-size: 22px;
      font-weight: bold;
      margin: 0 0 20px;
    }
    .content{
      color: #181818;
      font-size: 14px;
    }
    .tip{
      color: #6d6d6d;
      font-size: 10px;
      margin: 20px 0 0;
    }
    .box {
      margin: 40px auto 0;
      color: #181818;
      background-color: #ffffff;
      padding: 20px;
      border-radius: 5px;
      max-width: 640px;
    }
    </style>
    <div class="box">
      <div class="title">
        ${escapeHtml(subject)}
      </div>
      <div class="content">
        ${escapeHtml(text)}
      </div>
      ${
        tip
          ? `<div class="tip">
              ${escapeHtml(tip)}
            </div>`
          : ''
      }
    </div>
    `,
  })

  try {
    const info = await sendFunc
    return info.accepted[0] === to
  } catch (err) {
    log?.error({ err }, `[email] 邮箱发送失败，请确认配置是否正确 send mail to ${to} failed`)
    throw err
  }
}
