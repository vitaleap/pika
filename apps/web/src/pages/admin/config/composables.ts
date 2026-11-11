export type LoginType = 'password' | 'phone_code' | 'email_code'

export type AuthForm = {
  regEnabled: boolean
  loginTypes: LoginType[]
  regType: 'email' | 'phone'
}

export type MailForm = {
  enabled: boolean
  codeLen: number
  codeTtl: number
  host: string
  port: number
  ssl: boolean
  user: string
  pass: string
  senderName: string
}

export type FileForm = {
  maxSize: number
  allowedTypes: string
  disabledTypes: string
  ossEnabled: boolean
  ossEndpoint: string
  ossBucket: string
  ossAccessKeyId: string
  ossSecretAccessKey: string
  ossRegion: string
  ossForcePathStyle: boolean
  ossDefaultUrlExpiresIn: number
  ossHideFileUrl: boolean
}
