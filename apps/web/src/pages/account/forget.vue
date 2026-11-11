<template>
  <account-form
    ref="formRef"
    v-model="form"
    :option="option"
    @captcha-success="handleCaptchaSuccess"
  />
</template>
<script setup lang="tsx">
import { isPhone as isValidPhone } from '@pika/shared'
import { NButton, NIcon } from 'naive-ui'
import type { FormOption } from 'naive-plus'
import { useI18n } from 'vue-i18n'
import { sleep } from '@/utils/async'
import { throttle } from 'es-toolkit'
import AccountForm from './components/form.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const configStore = useConfigStore()
const formRef = useTemplateRef<InstanceType<typeof AccountForm>>('formRef')

/** 账号类型由后台「注册与登录」配置决定：邮箱 / 手机号 */
const isPhone = computed(() => configStore.config.auth.regType === 'phone')
const accountKey = computed(() => (isPhone.value ? 'phone' : 'email'))

// 管理员可能随时修改注册方式，进入页面时拉取最新配置
onMounted(() => {
  void configStore.refresh()
})

const form = ref({
  email: '',
  phone: '',
  password: '',
  code: '',
  // 行为验证码唯一标识
  uniqueId: '',
})

const {
  onClick: startCountdown,
  text: sendCodeText,
  disabled: sendCodeDisabled,
} = useCountdown({
  delay: 60,
  onClick: async () => {
    const uniqueId = form.value.uniqueId
    if (isPhone.value) {
      await Apis.auth.sendCode({ data: { channel: 'phone', phone: form.value.phone, uniqueId } })
    } else {
      await Apis.auth.sendCode({ data: { channel: 'email', email: form.value.email, uniqueId } })
    }
    window.$message.success(t('codeSent'))
  },
  textTemplate: (countdown) =>
    countdown === 0 ? t('sendCode') : t('countdown', { count: countdown }),
})

const handleCaptchaSuccess = (uniqueId: string) => {
  form.value.uniqueId = uniqueId
  void startCountdown()
}

const handleSendCode = throttle(
  async () => {
    await formRef.value?.validateFields(accountKey.value)
    formRef.value?.showCaptcha()
  },
  500,
  { edges: ['leading'] },
)

const option = computed<FormOption<typeof form.value>>(() => ({
  props: {
    showLabel: false,
  },
  footer: {
    submitBtn: {
      text: t('submit'),
      props: { block: true },
    },
    resetBtn: false,
  },
  onSubmit: async ({ password, code }) => {
    if (form.value.uniqueId === '') {
      window.$message.error(t('sendCodeFirst'))
      return
    }
    const payload = { password, code }
    if (isPhone.value) {
      await Apis.auth.forgetPassword({
        data: { channel: 'phone', phone: form.value.phone, ...payload },
      })
    } else {
      await Apis.auth.forgetPassword({
        data: { channel: 'email', email: form.value.email, ...payload },
      })
    }
    window.$message.success(t('recoverSuccess'))
    await sleep(150)
    router.replace((route.query.redirect as string) || '/login')
  },
  columns: [
    isPhone.value
      ? {
          key: 'phone',
          rule: [
            { required: true, trigger: 'input', message: t('required') },
            {
              validator: (value: string) =>
                isValidPhone(value) ? true : new Error(t('invalidPhone')),
              trigger: 'input',
            },
          ],
          props: { placeholder: t('phonePlaceholder'), maxlength: 20, clearable: true },
          slots: { prefix: () => [<NIcon class="i-mdi-cellphone"></NIcon>] },
        }
      : {
          key: 'email',
          rule: [
            { required: true, trigger: 'input', message: t('required') },
            { type: 'email', trigger: 'input', message: t('invalidEmail') },
          ],
          props: { placeholder: t('emailPlaceholder'), maxlength: 100, clearable: true },
          slots: { prefix: () => [<NIcon class="i-mdi-email"></NIcon>] },
        },
    {
      key: 'password',
      rule: [
        { required: true, trigger: 'input', message: t('required') },
        { trigger: 'input', min: 6, max: 30, message: t('passwordLength') },
      ],
      type: 'password',
      props: {
        placeholder: t('newPasswordPlaceholder'),
        showPasswordOn: 'click',
        maxlength: 50,
        inputProps: { autocomplete: 'new-password' },
      },
      slots: { prefix: () => [<NIcon class="i-mdi-password"></NIcon>] },
    },
    {
      key: 'code',
      rule: [
        { required: true, trigger: 'input', message: t('required') },
        { type: 'string', min: 4, max: 8, trigger: 'input', message: t('codeLength') },
      ],
      props: {
        placeholder: isPhone.value ? t('phoneCodePlaceholder') : t('emailCodePlaceholder'),
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
    },
  ],
}))
</script>

<i18n lang="yaml">
zh:
  codeSent: 验证码发送成功
  sendCode: 发送验证码
  countdown: 剩余{count}秒
  submit: 提交
  sendCodeFirst: 请先发送验证码
  recoverSuccess: 找回密码成功
  required: 不能为空
  invalidEmail: 邮箱格式错误
  invalidPhone: 手机号格式错误
  emailPlaceholder: 输入邮箱
  phonePlaceholder: 输入手机号
  passwordLength: 密码长度在 6-30 个字符
  newPasswordPlaceholder: 输入新密码
  codeLength: 验证码长度为 4-8 个字符
  emailCodePlaceholder: 请输入邮箱验证码
  phoneCodePlaceholder: 请输入短信验证码
en:
  codeSent: Verification code sent
  sendCode: Send code
  countdown: '{count}s remaining'
  submit: Submit
  sendCodeFirst: Send a verification code first
  recoverSuccess: Password recovered
  required: Required
  invalidEmail: Invalid email address
  invalidPhone: Invalid phone number
  emailPlaceholder: Email address
  phonePlaceholder: Phone number
  passwordLength: Password must be 6-30 characters
  newPasswordPlaceholder: New password
  codeLength: Verification code must be 4-8 characters
  emailCodePlaceholder: Email verification code
  phoneCodePlaceholder: SMS verification code
</i18n>
