<template>
  <n-input
    :value="value ?? ''"
    clearable
    @update:value="(val: string) => emit('update:value', val)"
  >
    <template #prefix>
      <n-icon class="i-mdi-shield-key"></n-icon>
    </template>
    <template #suffix>
      <np-button type="primary" :disabled="disabled" text :click="handleClick">
        {{ text }}
      </np-button>
    </template>
  </n-input>
  <go-captcha ref="captchaRef" @success="handleCaptchaSuccess"></go-captcha>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  value?: string
  /**
   * 点击即触发，例如先验证输入邮箱是否符合格式
   */
  onBefore?: () => Promise<void> | void
  /**
   * 发送验证码，如 onBefore 通过且行为验证码通过时触发
   * @param uniqueId
   */
  onSendCode: (uniqueId: string) => Promise<void> | void
}>()

const emit = defineEmits<{
  'update:value': [val: string]
}>()

const captchaRef = useTemplateRef('captchaRef')

const {
  onClick: startCountdown,
  text,
  disabled,
} = useCountdown({
  delay: 60,
  onClick: () => {
    window.$message.success(t('codeSent'))
  },
  textTemplate: (countdown) =>
    countdown === 0 ? t('sendCode') : t('countdown', { count: countdown }),
})

const handleCaptchaSuccess = async (uniqueId: string) => {
  await props.onSendCode(uniqueId)
  void startCountdown()
}

const handleClick = async () => {
  await props.onBefore?.()
  captchaRef.value?.show()
}
</script>

<i18n lang="yaml">
zh:
  codeSent: 验证码发送成功
  sendCode: 发送验证码
  countdown: 剩余{count}秒
en:
  codeSent: Verification code sent
  sendCode: Send code
  countdown: '{count}s remaining'
</i18n>
