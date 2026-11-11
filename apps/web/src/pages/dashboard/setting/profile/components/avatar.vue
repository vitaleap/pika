<template>
  <div class="pb-4 flex flex-row justify-start items-center gap-4">
    <w-avatar-upload
      :src="userStore.user.picture"
      :text="userStore.user.name"
      :size="64"
      @uploaded="onUploaded"
      @error="handleError"
    />
    <span class="text-size-xs color-text-2">{{ t('changeAvatar') }}</span>
  </div>
</template>

<script setup lang="ts">
import { useUserStore } from '@/stores/user'
import type { WAvatarUploadError } from '@pika/wrap-naive-ui'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const userStore = useUserStore()

const handleError = (error: WAvatarUploadError) => {
  window.$message.error(
    error.code === 'INVALID_TYPE'
      ? t('invalidImageType')
      : t('imageTooLarge', { size: error.maxSizeMb }),
  )
}

// w-config-provider 全局 Upload.customRequest 已负责上传到服务器，
// 这里只处理业务逻辑（更新用户头像 + 提示）
const onUploaded = async (url: string) => {
  try {
    await Apis.user.edit({ data: { picture: url } })
    userStore.user.picture = url
    window.$message.success(t('uploadSuccess'))
  } catch {
    window.$message.error(t('uploadFailed'))
  }
}
</script>

<i18n lang="yaml">
zh:
  changeAvatar: 点击头像修改
  uploadSuccess: 头像上传成功
  uploadFailed: 头像更新失败
  invalidImageType: 仅支持图片格式
  imageTooLarge: 图片大小不能超过{size}MB
en:
  changeAvatar: Click the avatar to change it
  uploadSuccess: Avatar updated
  uploadFailed: Avatar update failed
  invalidImageType: Only image files are supported
  imageTooLarge: Image size cannot exceed {size}MB
</i18n>
