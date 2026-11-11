import type { FormOption } from 'naive-plus'
import type { AuthForm } from './composables'
import { useI18n } from 'vue-i18n'
import type { LocaleMessages } from '@/utils/i18n'

const messages: LocaleMessages = {
  zh: {
    saveSuccess: '保存成功',
    allowRegistration: '允许注册',
    loginMethods: '登录方式',
    password: '密码',
    phoneCode: '手机验证码',
    emailCode: '邮箱验证码',
    atLeastOneMethod: '至少需要一种方式',
    registrationType: '注册方式',
    emailRegistration: '邮箱注册',
    phoneRegistration: '手机号注册',
  },
  en: {
    saveSuccess: 'Saved',
    allowRegistration: 'Allow registration',
    loginMethods: 'Login methods',
    password: 'Password',
    phoneCode: 'Phone code',
    emailCode: 'Email code',
    atLeastOneMethod: 'Select at least one method',
    registrationType: 'Registration method',
    emailRegistration: 'Email registration',
    phoneRegistration: 'Phone registration',
  },
}

export const useAuth = (onSaved: () => Promise<void> | void) => {
  const { t } = useI18n({ useScope: 'isolated', messages })
  const option = computed<FormOption<AuthForm>>(() => ({
    props: { labelPlacement: 'left', labelWidth: '120px' },
    footer: false,
    onSubmit: async (data) => {
      await Apis.adminConfig.update({ data: { auth: data } })
      window.$message.success(t('saveSuccess'))
      await onSaved()
    },
    columns: [
      {
        label: t('allowRegistration'),
        key: 'regEnabled',
        type: 'switch',
      },
      {
        label: t('registrationType'),
        key: 'regType',
        display: (data) => data.regEnabled,
        type: 'radio',
        options: [
          { label: t('emailRegistration'), value: 'email' },
          { label: t('phoneRegistration'), value: 'phone' },
        ],
      },
      {
        label: t('loginMethods'),
        key: 'loginTypes',
        type: 'checkbox',
        options: [
          { label: t('password'), value: 'password' },
          { label: t('phoneCode'), value: 'phone_code' },
          { label: t('emailCode'), value: 'email_code' },
        ],
        rule: {
          type: 'array',
          min: 1,
          message: t('atLeastOneMethod'),
        },
      },
    ],
  }))
  return { option }
}
