<template>
  <div class="flex flex-col h-full items-center justify-center md:pb-20">
    <n-result status="warning" title="404" :description="t('notFound')">
      <template #footer>
        <div class="flex gap-4 justify-center">
          <n-button @click="handleBackHome" type="default" secondary>{{ t('home') }}</n-button>
          <n-button @click="handleBackLast" type="primary" secondary>{{ t('back') }}</n-button>
        </div>
      </template>
    </n-result>
  </div>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const router = useRouter()
const handleBackHome = () => router.push('/')
const handleBackLast = () => router.back()

definePage({
  meta: {
    authRequired: false,
    layout: 'empty',
  },
})
</script>

<i18n lang="yaml">
zh:
  notFound: 页面不存在
  home: 返回首页
  back: 返回上一页
en:
  notFound: Page not found
  home: Home
  back: Go back
</i18n>
