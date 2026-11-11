<template>
  <div class="bg-picker">
    <button
      type="button"
      class="bg-picker__option"
      :class="{ 'is-active': type === 'color' }"
      @click="emit('changeType', 'color')"
    >
      <span class="bg-picker__thumb" :style="{ backgroundColor: solidBackgrounds[mode] }"></span>
      <span class="bg-picker__label">{{ t('color') }}</span>
    </button>

    <button
      type="button"
      class="bg-picker__option"
      :class="{ 'is-active': type === 'wallpaper' }"
      @click="emit('changeType', 'wallpaper')"
    >
      <span class="bg-picker__thumb">
        <img :src="wallpaperImages[mode]" alt="" />
      </span>
      <span class="bg-picker__label">{{ t('wallpaper') }}</span>
    </button>

    <div class="bg-picker__option" :class="{ 'is-active': type === 'image' }">
      <!-- 未上传时点击缩略图直接选文件，上传成功后自动选中自定义图片 -->
      <w-upload
        v-if="!url"
        v-slot="{ uploading }"
        class="bg-picker__trigger"
        accept="image/*"
        :before-upload="handleBeforeUpload"
        @uploaded="handleUploaded"
        @error="handleUploadError"
      >
        <span class="bg-picker__thumb is-empty">
          <n-icon size="16">
            <span :class="uploading ? 'i-mdi-loading animate-spin' : 'i-mdi-image-plus'"></span>
          </n-icon>
        </span>
      </w-upload>
      <template v-else>
        <button type="button" class="bg-picker__thumb" @click="emit('changeType', 'image')">
          <img :src="url" alt="" />
        </button>
        <button
          type="button"
          class="bg-picker__action bg-picker__float"
          :title="t('clear')"
          @click.stop="handleClear"
        >
          <n-icon size="12"><span class="i-mdi-close"></span></n-icon>
        </button>
      </template>
      <span class="bg-picker__label">{{ t('custom') }}</span>
    </div>
  </div>
</template>
<script setup lang="ts">
import type { UploadFileInfo } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { solidBackgrounds, wallpaperImages, type BackgroundType } from '@/stores/preference'

const props = withDefaults(
  defineProps<{
    mode: 'light' | 'dark'
    type: BackgroundType
    url: string
    maxSizeMb?: number
  }>(),
  { maxSizeMb: 5 },
)

const emit = defineEmits<{
  changeType: [value: BackgroundType]
  changeUrl: [value: string]
  error: [message: string]
}>()

const { t } = useI18n()

// 上传前的类型与大小校验，避免把非图片或超大文件传到服务端
const handleBeforeUpload = ({ file }: { file: UploadFileInfo }) => {
  const raw = file.file
  if (!raw || !raw.type.startsWith('image/')) {
    emit('error', t('invalidImageType'))
    return false
  }
  if (raw.size > props.maxSizeMb * 1024 * 1024) {
    emit('error', t('imageTooLarge', { size: props.maxSizeMb }))
    return false
  }
  return true
}

// 上传请求本身失败（网络/服务端）时由 w-upload 透出
const handleUploadError = () => emit('error', t('uploadFailed'))

const handleUploaded = (value: string) => {
  emit('changeUrl', value)
  emit('changeType', 'image')
}

// 清除只删除自定义图片，当前正在使用时回退到纯色背景
const handleClear = () => {
  emit('changeUrl', '')
  if (props.type === 'image') {
    emit('changeType', 'color')
  }
}
</script>
<style lang="scss" scoped>
.bg-picker {
  @apply flex flex-row gap-2;

  &__option {
    @apply relative flex flex-col items-center gap-1 rounded-lg bg-transparent p-1;
    border: 2px solid transparent;
    transition: border-color 0.15s;

    &.is-active {
      border-color: var(--n-primary-color);
    }
  }

  // naive-ui 的 .n-upload 默认 width:100%，需限定宽高，否则内部 trigger 会回到左上角
  &__trigger {
    @apply block;
    width: 56px;
    height: 35px;
  }

  // 缩略图右上角的浮层按钮（已上传时的清除），略微超出缩略图边角
  &__float {
    @apply absolute;
    top: -5px;
    right: -5px;
    width: 18px;
    height: 18px;
    transition: opacity 0.15s;
  }

  // 仅支持 hover 的设备默认隐藏，悬停到选项上再显示，避免与缩略图内容抢视觉
  @media (hover: hover) {
    &__float {
      opacity: 0;
    }

    &__option:hover &__float {
      opacity: 1;
    }
  }

  &__thumb {
    @apply flex items-center justify-center overflow-hidden rounded cursor-pointer;
    width: 56px;
    height: 35px;
    background: var(--color-bg-3);
    box-shadow: 0 0 0 1px rgb(0 0 0 / 10%);

    img {
      @apply block h-full w-full object-cover;
    }

    &.is-empty {
      @apply border border-dashed color-text-3;
      border-color: var(--color-border);
      box-shadow: none;
    }
  }

  &__action {
    @apply flex items-center justify-center rounded-full cursor-pointer;
    width: 18px;
    height: 18px;
    border: none;
    color: #fff;
    background: rgb(0 0 0 / 55%);

    &:hover {
      background: rgb(0 0 0 / 75%);
    }
  }

  &__label {
    @apply text-xs color-text-2;
  }

  &__option.is-active &__label {
    @apply color-text-1;
  }
}
</style>

<i18n lang="yaml">
zh:
  color: 纯色
  wallpaper: macOS 墙纸
  custom: 自定义
  clear: 清除图片
  uploadFailed: 背景图上传失败
  invalidImageType: 仅支持图片格式
  imageTooLarge: 图片大小不能超过{size}MB
en:
  color: Solid
  wallpaper: macOS wallpaper
  custom: Custom
  clear: Remove image
  uploadFailed: Background image upload failed
  invalidImageType: Only image files are supported
  imageTooLarge: Image size cannot exceed {size}MB
</i18n>
