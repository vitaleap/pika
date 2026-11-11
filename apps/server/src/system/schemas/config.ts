import { customType, snakeCase } from 'drizzle-orm/pg-core'
import { baseColumns } from '@/common/db/base/columns'

type AuthConfig = {
  /**
   * 是否开启注册功能
   * @default true
   */
  regEnabled: boolean
  /**
   * 登录类型
   * @default ['password']
   */
  loginTypes: Array<'password' | 'phone_code' | 'email_code'>
  /**
   * 注册方式
   * @default 'email'
   */
  regType: 'email' | 'phone'
}

type MailConfig =
  | {
      enabled: false
    }
  | {
      enabled: true
      /**
       * 验证码长度
       * @default 6
       */
      codeLen: number
      /**
       * 验证码过期时间，单位秒
       * @default 300
       */
      codeTtl: number
      /**
       * 邮件服务主机名
       * @default smtp.ethereal.email
       */
      host: string
      /**
       * 邮件服务端口号
       * @default 587
       */
      port: number
      /**
       * 是否使用安全连接
       * @default true
       */
      ssl: boolean
      /**
       * 邮件服务用户名
       */
      user: string
      /**
       * 邮件服务密码
       */
      pass: string
      /**
       * 邮件发送者名称
       * @default pika
       */
      senderName: string
    }

type FileConfig = {
  /**
   * 支持文件上传最大尺寸，单位字节
   * @default 20971520
   */
  maxSize: number
  /**
   * 允许上传文件类型，在默认类型上增加，使用逗号隔开
   */
  allowedTypes: string[]
  /**
   * 禁止上传文件类型，优先于默认类型和允许类型，使用逗号隔开
   */
  disabledTypes: string[]
} & (
  | {
      ossEnabled: false
    }
  | {
      ossEnabled: true
      ossEndpoint: string
      ossBucket: string
      ossAccessKeyId: string
      ossSecretAccessKey: string
      ossRegion: string
      ossForcePathStyle: boolean
      ossDefaultUrlExpiresIn: number
      /**
       * 是否隐藏文件真实 URL
       * - false：下载接口 302 跳转到对象存储直链，文件流量不过服务器
       * - true：下载由服务端代理读取文件流
       * @default false
       */
      ossHideFileUrl: boolean
    }
)

/**
 * JSON 配置组通用自定义类型。
 * 数据库存储为 `jsonb`，读写时按目标类型反序列化/序列化。
 */
const configGroupType = <T>() =>
  customType<{
    data: T
    driverData: T
  }>({
    dataType() {
      return 'jsonb'
    },
  })

const authType = configGroupType<AuthConfig>()
const mailType = configGroupType<MailConfig>()
const fileType = configGroupType<FileConfig>()

const authDefaults: AuthConfig = {
  regEnabled: true,
  loginTypes: ['password'],
  regType: 'email',
}

const mailDefaults: MailConfig = {
  enabled: false,
}

const fileDefaults: FileConfig = {
  maxSize: 20 * 1024 * 1024,
  allowedTypes: [],
  disabledTypes: [],
  ossEnabled: false,
}

export const config = snakeCase.table('config', (t) => ({
  ...baseColumns(t),
  auth: authType()
    .$defaultFn(() => authDefaults)
    .notNull(),
  mail: mailType()
    .$defaultFn(() => mailDefaults)
    .notNull(),
  file: fileType()
    .$defaultFn(() => fileDefaults)
    .notNull(),
}))

export type Config = typeof config.$inferSelect
export type ConfigInsert = typeof config.$inferInsert
