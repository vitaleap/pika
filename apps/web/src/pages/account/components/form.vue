<template>
  <np-form ref="formRef" v-model="form" :option="option" />
  <go-captcha ref="captchaRef" @success="handleCaptchaSuccess"></go-captcha>
</template>
<script setup lang="ts">
import type { FormInst, FormOption } from 'naive-plus'

/**
 * 账号表单通用容器：只负责渲染表单与行为验证码，
 * 表单配置（option）由 prop 传入，发送验证码、提交等业务逻辑由使用方监听事件后自行实现。
 */
const form = defineModel<Record<string, any>>({ required: true })

defineProps<{
  option: FormOption<any>
}>()

const emit = defineEmits<{
  (event: 'captchaSuccess', uniqueId: string): void
}>()

const formRef = useTemplateRef<FormInst>('formRef')
const captchaRef = useTemplateRef('captchaRef')

const handleCaptchaSuccess = (uniqueId: string) => {
  emit('captchaSuccess', uniqueId)
}

defineExpose({
  /** 校验指定字段，校验失败会抛出异常 */
  validateFields: (fields: string | string[]) => formRef.value?.validateFields(fields),
  /** 弹出行为验证码，通过后触发 captchaSuccess 事件 */
  showCaptcha: () => captchaRef.value?.show(),
})
</script>
