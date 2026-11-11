<template>
  <w-upload
    v-slot="{ uploading }"
    class="group"
    :style="{ width: `${sizePx}px`, height: `${sizePx}px` }"
    :accept="merged.accept"
    :before-upload="handleBeforeUpload"
    @uploaded="(url) => emit('uploaded', url)"
  >
    <div
      class="relative cursor-pointer rounded-full overflow-hidden"
      :style="{ width: `${sizePx}px`, height: `${sizePx}px` }"
    >
      <w-avatar
        :src="merged.src"
        :text="merged.text"
        :size="merged.size"
        :font-size="merged.fontSize"
        :color="merged.color"
        :text-max-chars="merged.textMaxChars"
        :text-case="merged.textCase"
        :base-url="merged.baseUrl"
        round
      />
      <div
        class="absolute inset-0 flex items-center justify-center bg-black/50 transition-opacity"
        :class="uploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
      >
        <NIcon size="22" color="#fff">
          <span :class="uploading ? 'i-mdi-loading animate-spin' : 'i-mdi-camera'"></span>
        </NIcon>
      </div>
    </div>
  </w-upload>
</template>

<script setup lang="ts">
import { NIcon, type UploadFileInfo } from 'naive-ui'
import { computed, inject } from 'vue'
import { WAvatar, WUpload } from '../../index.ts'
import { wConfigProviderInjectionKey } from '../../config-provider'
import { WAvatarUploadDefaults, type WAvatarUploadError, type WAvatarUploadProps } from './prop'

// 保留 defaultProps 为 undefined 状态，让 w-config-provider.componentOptions.AvatarUpload
// 能在 prop 未传时介入（优先级：prop > provider > defaults）
const defaultProps = defineProps<WAvatarUploadProps>()

const emit = defineEmits<{
  /** 默认校验（类型/大小）失败或用户 `beforeUpload` 返回 `false` 时触发；文案由调用方翻译 */
  (e: 'error', error: WAvatarUploadError): void
  /** 上传成功，参数为新 URL（由 w-config-provider.Upload.customRequest 提供） */
  (e: 'uploaded', url: string): void
}>()

const injected = inject(wConfigProviderInjectionKey, undefined)
const merged = computed<WAvatarUploadProps>(() => {
  const o = injected?.value?.AvatarUpload
  const userProps = Object.fromEntries(
    Object.entries(defaultProps).filter(([_, v]) => v !== undefined),
  ) as Partial<WAvatarUploadProps>
  return Object.assign({}, WAvatarUploadDefaults, o, userProps)
})

// 把 size 字符串转成像素，用于外层触发器容器尺寸
const sizePx = computed(() => {
  const s = merged.value.size
  if (typeof s === 'number') return s
  if (s === 'small') return 32
  if (s === 'medium') return 48
  return 64
})

// 默认校验：图片类型 + 大小；通过后再执行用户自定义校验
const handleBeforeUpload = (data: { file: UploadFileInfo }) => {
  const rawFile = data.file.file
  if (!rawFile || !rawFile.type.startsWith('image/')) {
    emit('error', { code: 'INVALID_TYPE' })
    return false
  }
  const max = merged.value.maxSize ?? 0
  if (max > 0 && rawFile.size > max) {
    emit('error', { code: 'FILE_TOO_LARGE', maxSizeMb: Math.round(max / 1024 / 1024) })
    return false
  }
  const fn = merged.value.beforeUpload
  if (fn && fn(data) === false) return false
  return true
}
</script>
