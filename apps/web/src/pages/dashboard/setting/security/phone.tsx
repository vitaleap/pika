import { type FormColumn, type FormInst, type FormOption, type Rule } from 'naive-plus'
import { NIcon } from 'naive-ui'
import { PHONE_PATTERN } from '@pika/shared'
import CodeInput from './components/code-input.vue'
import { useI18n } from 'vue-i18n'
import type { LocaleMessages } from '@/utils/i18n'

const messages: LocaleMessages = {
  zh: {
    required: '不能为空',
    invalidPhone: '请输入正确的手机号',
    codeLength: '验证码长度为 4-8 个字符',
    sendOldCodeFirst: '请先发送旧手机号验证码',
    sendNewCodeFirst: '请先发送新手机号验证码',
    success: '修改成功',
    oldPhone: '旧手机号',
    currentPhonePlaceholder: '输入当前手机号',
    newPhone: '新手机号',
    newPhonePlaceholder: '输入新手机号',
    samePhone: '新手机号不能与当前手机号相同',
    phoneInUse: '该手机号已被他人使用',
  },
  en: {
    required: 'Required',
    invalidPhone: 'Enter a valid phone number',
    codeLength: 'Verification code must be 4-8 characters',
    sendOldCodeFirst: 'Send a code to the current phone number first',
    sendNewCodeFirst: 'Send a code to the new phone number first',
    success: 'Phone number changed',
    oldPhone: 'Current phone number',
    currentPhonePlaceholder: 'Current phone number',
    newPhone: 'New phone number',
    newPhonePlaceholder: 'New phone number',
    samePhone: 'New phone number must differ from the current phone number',
    phoneInUse: 'This phone number is already used by another account',
  },
}

type PhoneForm = {
  oldPhone: string
  newPhone: string
  oldCode: string
  newCode: string
  oldCodeUniqueId: string
  newCodeUniqueId: string
}

export const usePhone = (
  currentPhone: Ref<string>,
  phoneFormRef: Ref<FormInst | undefined>,
  onSuccess: () => Promise<void> | void,
) => {
  const { t } = useI18n({ useScope: 'isolated', messages })
  const phoneRule = (): Rule[] => [
    { required: true, trigger: ['input', 'blur'], message: t('required') },
    { pattern: PHONE_PATTERN, trigger: ['blur'], message: t('invalidPhone') },
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

  const phoneOption = computed<FormOption<PhoneForm>>(() => {
    // 未绑定手机号时无需填写与验证旧手机号
    const hasPhone = Boolean(currentPhone.value)
    const columns: FormColumn<PhoneForm>[] = []

    if (hasPhone) {
      columns.push(
        {
          render: () => <div class="mb-2 color-text-2">{t('oldPhone')}</div>,
        },
        {
          key: 'oldPhone',
          type: 'text',
          props: {
            placeholder: t('currentPhonePlaceholder'),
            maxlength: 20,
            clearable: true,
            disabled: true,
          },
          defaultValue: currentPhone.value,
          slots: { prefix: () => [h(NIcon, { class: 'i-mdi-cellphone' })] },
          rule: phoneRule(),
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
                  await phoneFormRef.value?.validateFields('oldPhone')
                }}
                onSendCode={async (uniqueId) => {
                  data.oldCodeUniqueId = uniqueId
                  await Apis.auth.sendCode({
                    data: { channel: 'phone', phone: data.oldPhone, uniqueId },
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
        render: () => <div class="mb-2 color-text-2">{t('newPhone')}</div>,
      },
      {
        key: 'newPhone',
        type: 'text',
        props: {
          placeholder: t('newPhonePlaceholder'),
          maxlength: 20,
          clearable: true,
        },
        slots: { prefix: () => [h(NIcon, { class: 'i-mdi-cellphone' })] },
        rule: (data) => [
          ...phoneRule(),
          {
            validator: async (value: string) => {
              if (value === data.oldPhone) {
                throw new Error(t('samePhone'))
              }
              if (!value) {
                return
              }
              // 修改前向后端确认手机号未被他人使用
              const { available } = await Apis.user.checkPhone({ data: { phone: value } })
              if (!available) {
                throw new Error(t('phoneInUse'))
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
                await phoneFormRef.value?.validateFields('newPhone')
              }}
              onSendCode={async (uniqueId) => {
                data.newCodeUniqueId = uniqueId
                await Apis.auth.sendCode({
                  data: { channel: 'phone', phone: data.newPhone, uniqueId },
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
        if (hasPhone && !form.oldCodeUniqueId) {
          window.$message.error(t('sendOldCodeFirst'))
          return
        }
        if (!form.newCodeUniqueId) {
          window.$message.error(t('sendNewCodeFirst'))
          return
        }
        await Apis.user.editPhone({
          data: {
            ...(hasPhone ? { oldPhone: form.oldPhone, oldCode: form.oldCode } : {}),
            newPhone: form.newPhone,
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
    phoneOption,
  }
}
