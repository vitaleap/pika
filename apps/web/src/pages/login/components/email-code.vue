<template>
  <np-form ref="formRef" v-model="formData" :option="option" />
  <go-captcha ref="captchaRef" @success="handleCaptchaSuccess"></go-captcha>
</template>
<script setup lang="tsx">
import { NButton, NIcon } from 'naive-ui'
import type { FormInst, FormOption } from 'naive-plus'
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
  email: string
  code: string
}

const formData = ref<Form>({
  email: '',
  code: '',
})

const {
  onClick: startCountdown,
  text: sendCodeText,
  disabled: sendCodeDisabled,
} = useCountdown({
  delay: 60,
  onClick: async () => {
    await userStore.sendCode('email', formData.value.email, uniqueId.value)
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
    await formRef.value?.validateFields(['email'])
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
      props: {
        block: true,
      },
    },
    resetBtn: false,
  },
  onSubmit: async ({ email, code }) => {
    await userStore.loginEmailCode(email, code)
    emit('ok')
  },
  columns: [
    {
      key: 'email',
      rule: [
        { required: true, trigger: 'input', message: t('required') },
        { type: 'email', trigger: 'input', message: t('invalidEmail') },
      ],
      props: { placeholder: t('emailPlaceholder'), maxlength: 100, clearable: true },
      slots: { prefix: () => [<NIcon class="i-mdi-email"></NIcon>] },
    },
    {
      key: 'code',
      props: { placeholder: t('codePlaceholder'), maxlength: 9, clearable: true },
      rule: { required: true, trigger: 'input', message: t('required') },
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
  emailPlaceholder: 输入邮箱
  codePlaceholder: 输入验证码
  required: 不能为空
  invalidEmail: 邮箱格式错误
en:
  login: Log in
  codeSent: Verification code sent
  sendCode: Send code
  countdown: '{count}s remaining'
  emailPlaceholder: Email address
  codePlaceholder: Verification code
  required: Required
  invalidEmail: Invalid email address
</i18n>
