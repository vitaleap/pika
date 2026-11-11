import { type FormColumn, type FormInst, type FormOption, type Rule } from 'naive-plus'
import { NIcon } from 'naive-ui'
import CodeInput from './components/code-input.vue'
import { useI18n } from 'vue-i18n'
import type { LocaleMessages } from '@/utils/i18n'

const messages: LocaleMessages = {
  zh: {
    required: '不能为空',
    invalidEmail: '请输入正确的邮箱地址',
    codeLength: '验证码长度为 4-8 个字符',
    sendOldCodeFirst: '请先发送旧邮箱验证码',
    sendNewCodeFirst: '请先发送新邮箱验证码',
    success: '修改成功',
    oldEmail: '旧邮箱',
    currentEmailPlaceholder: '输入当前邮箱',
    newEmail: '新邮箱',
    newEmailPlaceholder: '输入新邮箱',
    sameEmail: '新邮箱不能与当前邮箱相同',
    emailInUse: '该邮箱已被他人使用',
  },
  en: {
    required: 'Required',
    invalidEmail: 'Enter a valid email address',
    codeLength: 'Verification code must be 4-8 characters',
    sendOldCodeFirst: 'Send a code to the current email first',
    sendNewCodeFirst: 'Send a code to the new email first',
    success: 'Email changed',
    oldEmail: 'Current email',
    currentEmailPlaceholder: 'Current email address',
    newEmail: 'New email',
    newEmailPlaceholder: 'New email address',
    sameEmail: 'New email must differ from the current email',
    emailInUse: 'This email is already used by another account',
  },
}

type EmailForm = {
  oldEmail: string
  newEmail: string
  oldCode: string
  newCode: string
  oldCodeUniqueId: string
  newCodeUniqueId: string
}

export const useEmail = (
  currentEmail: Ref<string>,
  emailFormRef: Ref<FormInst | undefined>,
  onSuccess: () => Promise<void> | void,
) => {
  const { t } = useI18n({ useScope: 'isolated', messages })
  const emailRule = (): Rule[] => [
    { required: true, trigger: ['input', 'blur'], message: t('required') },
    { type: 'email', trigger: ['blur'], message: t('invalidEmail') },
  ]
  const codeRule = (): Rule[] => [
    { required: true, trigger: ['input', 'blur'], message: t('required') },
    {
      type: 'string',
      min: 4,
      max: 8,
      trigger: 'blur',
      message: t('codeLength'),
    },
  ]

  const emailOption = computed<FormOption<EmailForm>>(() => {
    // 未绑定邮箱时无需填写与验证旧邮箱
    const hasEmail = Boolean(currentEmail.value)
    const columns: FormColumn<EmailForm>[] = []

    if (hasEmail) {
      columns.push(
        {
          render: () => <div class="mb-2 color-text-2">{t('oldEmail')}</div>,
        },
        {
          key: 'oldEmail',
          type: 'text',
          props: {
            placeholder: t('currentEmailPlaceholder'),
            maxlength: 100,
            clearable: true,
            disabled: true,
          },
          defaultValue: currentEmail.value,
          slots: { prefix: () => [h(NIcon, { class: 'i-mdi-email' })] },
          rule: emailRule(),
        },
        {
          type: (data) => {
            return (
              <CodeInput
                value={data.oldCode}
                onUpdate:value={(val: string) => {
                  data.oldCode = val
                }}
                onBefore={async () => {
                  await emailFormRef.value?.validateFields('oldEmail')
                }}
                onSendCode={async (uniqueId) => {
                  data.oldCodeUniqueId = uniqueId
                  await Apis.auth.sendCode({
                    data: { channel: 'email', email: data.oldEmail, uniqueId },
                  })
                }}
              />
            )
          },
          key: 'oldCode',
          rule: codeRule(),
        },
      )
    }

    columns.push(
      {
        render: () => <div class="mb-2 color-text-2">{t('newEmail')}</div>,
      },
      {
        key: 'newEmail',
        type: 'text',
        props: {
          placeholder: t('newEmailPlaceholder'),
          maxlength: 100,
          clearable: true,
        },
        slots: { prefix: () => [h(NIcon, { class: 'i-mdi-email' })] },
        rule: (data) => [
          ...emailRule(),
          {
            validator: async (value: string) => {
              if (value === data.oldEmail) {
                throw new Error(t('sameEmail'))
              }
              if (!value) {
                return
              }
              // 修改前向后端确认邮箱未被他人使用
              const { available } = await Apis.user.checkEmail({ data: { email: value } })
              if (!available) {
                throw new Error(t('emailInUse'))
              }
            },
            trigger: 'blur',
          },
        ],
      },
      {
        type: (data) => {
          return (
            <CodeInput
              value={data.newCode}
              onUpdate:value={(val: string) => {
                data.newCode = val
              }}
              onBefore={async () => {
                await emailFormRef.value?.validateFields('newEmail')
              }}
              onSendCode={async (uniqueId) => {
                data.newCodeUniqueId = uniqueId
                await Apis.auth.sendCode({
                  data: { channel: 'email', email: data.newEmail, uniqueId },
                })
              }}
            />
          )
        },
        key: 'newCode',
        rule: codeRule(),
      },
    )

    return {
      props: {
        showLabel: false,
      },
      footer: false,
      onSubmit: async (form) => {
        if (hasEmail && !form.oldCodeUniqueId) {
          window.$message.error(t('sendOldCodeFirst'))
          return
        }
        if (!form.newCodeUniqueId) {
          window.$message.error(t('sendNewCodeFirst'))
          return
        }
        await Apis.user.editEmail({
          data: {
            ...(hasEmail ? { oldEmail: form.oldEmail, oldCode: form.oldCode } : {}),
            newEmail: form.newEmail,
            newCode: form.newCode,
          },
        })
        window.$message.success(t('success'))
        await onSuccess()
      },
      columns,
    }
  })

  return {
    emailOption,
  }
}
