<template>
  <NUpload
    :show-file-list="merged.showFileList"
    :accept="merged.accept"
    :custom-request="handleCustomRequest"
    @before-upload="handleBeforeUpload"
  >
    <slot :uploading="uploading" />
  </NUpload>
</template>

<script setup lang="ts">
import { NUpload, type UploadFileInfo } from 'naive-ui'
import type { CustomRequest } from 'naive-ui/es/upload/src/interface'
import { computed, inject, ref } from 'vue'
import { wConfigProviderInjectionKey } from '../../config-provider'
import { WUploadDefaults, type WUploadProps } from './prop'

// 保留 defaultProps 为 undefined 状态，让 w-config-provider.componentOptions.Upload
// 能在 prop 未传时介入（优先级：prop > provider > defaults）
const defaultProps = defineProps<WUploadProps>()

const emit = defineEmits<{
  /** 上传前校验，返回 `false` 阻止上传 */
  (e: 'beforeUpload', data: { file: UploadFileInfo }): boolean | void
  /**
   * 上传成功。`customRequest` 应将返回的 url 写入 `options.file.url`，
   * w-upload 读取后透传出来，让上层组件（如 w-avatar-upload）继续处理业务。
   */
  (e: 'uploaded', url: string): void
  /** 上传失败 */
  (e: 'error'): void
}>()

const uploading = ref(false)

const injected = inject(wConfigProviderInjectionKey, undefined)
const merged = computed<WUploadProps>(() => {
  const o = injected?.value?.Upload
  const userProps = Object.fromEntries(
    Object.entries(defaultProps).filter(([_, v]) => v !== undefined),
  ) as Partial<WUploadProps>
  return Object.assign({}, WUploadDefaults, o, userProps)
})

const handleBeforeUpload = (data: { file: UploadFileInfo }) => {
  const fn = merged.value.beforeUpload
  if (!fn) {
    return true
  }
  return fn(data)
}

// 包装 customRequest：
// 1. 维护 uploading ref（通过 slot props 暴露给上层）
// 2. 在 customRequest 写入 file.url 后，emit 'uploaded' 透传 url
const handleCustomRequest: CustomRequest = (options) => {
  const cr = merged.value.customRequest
  if (!cr) {
    options.onError()
    return
  }
  uploading.value = true
  cr({
    ...options,
    onFinish: () => {
      uploading.value = false
      options.onFinish()
      if (options.file.url) {
        emit('uploaded', options.file.url)
      }
    },
    onError: () => {
      uploading.value = false
      options.onError()
      emit('error')
    },
  })
}
</script>
