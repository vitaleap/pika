import type { FormOption } from 'naive-plus'
import type { MailForm } from './composables'
import { useI18n } from 'vue-i18n'
import type { LocaleMessages } from '@/utils/i18n'

const messages: LocaleMessages = {
  zh: {
    saveSuccess: '保存成功',
    enableMail: '开启邮件服务',
    codeLength: '验证码长度',
    enterCodeLength: '请输入验证码长度',
    codeTtl: '验证码有效期',
    enterCodeTtl: '请输入验证码有效期',
    smtpHost: 'SMTP 主机',
    enterSmtpHost: '请输入 SMTP 主机',
    smtpPort: 'SMTP 端口',
    enterSmtpPort: '请输入 SMTP 端口',
    useSsl: '使用 SSL',
    username: '用户名',
    enterUsername: '请输入用户名',
    password: '密码',
    enterPassword: '请输入密码',
    senderName: '发件人名称',
    enterSenderName: '请输入发件人名称',
  },
  en: {
    saveSuccess: 'Saved',
    enableMail: 'Enable email service',
    codeLength: 'Code length',
    enterCodeLength: 'Enter a code length',
    codeTtl: 'Code lifetime',
    enterCodeTtl: 'Enter a code lifetime',
    smtpHost: 'SMTP host',
    enterSmtpHost: 'Enter an SMTP host',
    smtpPort: 'SMTP port',
    enterSmtpPort: 'Enter an SMTP port',
    useSsl: 'Use SSL',
    username: 'Username',
    enterUsername: 'Enter a username',
    password: 'Password',
    enterPassword: 'Enter a password',
    senderName: 'Sender name',
    enterSenderName: 'Enter a sender name',
  },
}

export const useMail = (onSaved: () => Promise<void> | void) => {
  const { t } = useI18n({ useScope: 'isolated', messages })
  const option = computed<FormOption<MailForm>>(() => ({
    props: { labelPlacement: 'left', labelWidth: '100px' },
    footer: false,
    onSubmit: async (data) => {
      const payload = data.enabled ? data : { enabled: false }
      await Apis.adminConfig.update({ data: { mail: payload } })
      window.$message.success(t('saveSuccess'))
      await onSaved()
    },
    columns: [
      { label: t('enableMail'), key: 'enabled', type: 'switch' },
      {
        label: t('codeLength'),
        key: 'codeLen',
        type: 'number',
        props: { min: 4, max: 8 },
        formItemProps: {},
        rule: [
          {
            type: 'number',
            required: true,
            trigger: ['change'],
            message: t('enterCodeLength'),
          },
        ],
        display: (row) => row.enabled,
      },
      {
        label: t('codeTtl'),
        key: 'codeTtl',
        type: 'number',
        props: { min: 60, max: 3600 },
        rule: [
          {
            type: 'number',
            required: true,
            trigger: ['change'],
            message: t('enterCodeTtl'),
          },
        ],
        display: (row) => row.enabled,
      },
      {
        label: t('smtpHost'),
        key: 'host',
        props: { placeholder: 'smtp.example.com' },
        rule: [{ required: true, trigger: ['blur'], message: t('enterSmtpHost') }],
        display: (row) => row.enabled,
      },
      {
        label: t('smtpPort'),
        key: 'port',
        type: 'number',
        props: { min: 1, max: 65535 },
        rule: [
          {
            type: 'number',
            required: true,
            trigger: ['change'],
            message: t('enterSmtpPort'),
          },
        ],
        display: (row) => row.enabled,
      },
      {
        label: t('useSsl'),
        key: 'ssl',
        type: 'switch',
        display: (row) => row.enabled,
      },
      {
        label: t('username'),
        key: 'user',
        rule: [{ required: true, trigger: ['blur'], message: t('enterUsername') }],
        display: (row) => row.enabled,
      },
      {
        label: t('password'),
        key: 'pass',
        type: 'password',
        rule: [{ required: true, trigger: ['blur'], message: t('enterPassword') }],
        display: (row) => row.enabled,
      },
      {
        label: t('senderName'),
        key: 'senderName',
        rule: [{ required: true, trigger: ['blur'], message: t('enterSenderName') }],
        display: (row) => row.enabled,
      },
    ],
  }))
  return { option }
}
