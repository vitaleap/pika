<template>
  <np-form ref="formRef" v-model="formData" :option="option" />
  <go-captcha ref="captchaRef" @success="handleCaptchaSuccess"></go-captcha>
</template>
<script setup lang="tsx">
import { NButton, NIcon } from 'naive-ui'
import type { FormInst, FormOption } from 'naive-plus'
import { isPhone } from '@pika/shared'
import { useUserStore } from '@/stores/user'
import { throttle } from 'es-toolkit'
import { useI18n } from 'vue-i18n'

const emit = defineEmits<{
  (event: 'ok'): void
}>()
const userStore = useUserStore()
const { t } = useI18n()
const formRef = useTemplateRef<FormInst>('formRef')
const captchaRef = useTemplateRef('captchaRef')
const uniqueId = ref('')

type Form = {
  phone: string
  code: string
}

const formData = ref<Form>({
  phone: '',
  code: '',
})

const {
  onClick: startCountdown,
  text: sendCodeText,
  disabled: sendCodeDisabled,
} = useCountdown({
  delay: 60,
  onClick: async () => {
    await userStore.sendCode('phone', formData.value.phone, uniqueId.value)
    window.$message.success(t('codeSent'))
  },
  textTemplate: (countdown) =>
    countdown === 0 ? t('sendCode') : t('countdown', { count: countdown }),
})

const handleCaptchaSuccess = (id: string) => {
  uniqueId.value = id
  void startCountdown()
}

const handleSendCode = throttle(
  async () => {
    await formRef.value?.validateFields(['phone'])
    captchaRef.value?.show()
  },
  500,
  { edges: ['leading'] },
)

const option = computed<FormOption<Form>>(() => ({
  props: {
    showLabel: false,
  },
  footer: {
    submitBtn: {
      text: t('login'),
      props: { block: true },
    },
    resetBtn: false,
  },
  onSubmit: async ({ phone, code }) => {
    await userStore.loginPhoneCode(phone, code)
    emit('ok')
  },
  columns: [
    {
      key: 'phone',
      props: {
        placeholder: t('phonePlaceholder'),
        maxlength: 20,
        clearable: true,
      },
      slots: { prefix: () => [<NIcon class="i-mdi-cellphone"></NIcon>] },
      rule: [
        { required: true, trigger: 'input', message: t('required') },
        {
          validator: (value: string) => (isPhone(value) ? true : new Error(t('invalidPhone'))),
          trigger: 'input',
        },
      ],
    },
    {
      key: 'code',
      props: {
        placeholder: t('codePlaceholder'),
        maxlength: 9,
        clearable: true,
      },
      slots: {
        prefix: () => [<NIcon class="i-mdi-shield-key"></NIcon>],
        suffix: () => [
          <NButton
            disabled={sendCodeDisabled.value}
            type="primary"
            text
            onClick={(event: MouseEvent) => {
              event.stopPropagation()
              handleSendCode()
            }}
          >
            {{ default: () => sendCodeText.value }}
          </NButton>,
        ],
      },
      rule: { required: true, trigger: 'input', message: t('required') },
    },
  ],
}))
</script>

<i18n lang="yaml">
zh:
  login: 登录
  codeSent: 验证码发送成功
  sendCode: 发送验证码
  countdown: 剩余{count}秒
  phonePlaceholder: 输入手机号
  codePlaceholder: 输入验证码
  required: 不能为空
  invalidPhone: 手机号格式错误
en:
  login: Log in
  codeSent: Verification code sent
  sendCode: Send code
  countdown: '{count}s remaining'
  phonePlaceholder: Phone number
  codePlaceholder: Verification code
  required: Required
  invalidPhone: Invalid phone number
</i18n>
