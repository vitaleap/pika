import type { FormColumn, FormOption } from 'naive-plus'
import { sleep } from '@/utils/async'
import { NIcon } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { LocaleMessages } from '@/utils/i18n'

const messages: LocaleMessages = {
  zh: {
    required: '不能为空',
    passwordLength: '密码长度在 6-30 个字符',
    sameAsOld: '新密码不能与旧密码相同',
    mismatch: '新密码不一致',
    success: '修改成功',
    oldPassword: '输入旧密码',
    newPassword: '输入新密码',
    confirmPassword: '确认新密码',
  },
  en: {
    required: 'Required',
    passwordLength: 'Password must be 6-30 characters',
    sameAsOld: 'New password must differ from the old password',
    mismatch: 'Passwords do not match',
    success: 'Password changed',
    oldPassword: 'Current password',
    newPassword: 'New password',
    confirmPassword: 'Confirm new password',
  },
}

export const usePassword = (onSuccess: () => void) => {
  const { t } = useI18n({ useScope: 'isolated', messages })
  type FormData = {
    password: string
    newPassword: string
    confirmNewPassword: string
  }

  const passwordCommon: FormColumn<FormData> = {
    type: 'password',
    props: {
      showPasswordOn: 'click' as const,
      maxlength: 50,
      clearable: true,
      inputProps: { autocomplete: 'new-password' },
    },
    slots: {
      prefix: () => [h(NIcon, { class: 'i-mdi-password' })],
    },
    rule: (data) => {
      return [
        { required: true, trigger: ['input', 'blur'], message: t('required') },
        { trigger: 'input', min: 6, max: 30, message: t('passwordLength') },
        {
          validator: (value, rule) => {
            const field = rule.field
            if (field === 'newPassword' && value && value === data.password) {
              return new Error(t('sameAsOld'))
            }
            if (field === 'confirmNewPassword' && value !== data.newPassword) {
              return new Error(t('mismatch'))
            }
            return true
          },
          trigger: ['change', 'blur'],
        },
      ]
    },
  }

  const passwordOption = computed<FormOption<FormData>>(() => ({
    onSubmit: async (data) => {
      await Apis.user.edit({ data })
      window.$message.success(t('success'))
      onSuccess()
    },
    props: {
      showLabel: false,
    },
    footer: false,
    columns: [
      {
        key: 'password',
        type: 'password',
        props: {
          placeholder: t('oldPassword'),
          ...passwordCommon.props,
        },
        slots: passwordCommon.slots,
        rule: passwordCommon.rule,
      },
      {
        key: 'newPassword',
        type: 'password',
        props: {
          placeholder: t('newPassword'),
          ...passwordCommon.props,
        },
        slots: passwordCommon.slots,
        rule: passwordCommon.rule,
      },
      {
        key: 'confirmNewPassword',
        type: 'password',
        props: {
          placeholder: t('confirmPassword'),
          ...passwordCommon.props,
        },
        slots: passwordCommon.slots,
        rule: passwordCommon.rule,
      },
    ],
  }))
  return {
    passwordOption,
  }
}
