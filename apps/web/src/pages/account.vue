<template>
  <n-layout position="absolute">
    <div class="flex flex-row h-full w-full items-center justify-center">
      <n-card
        class="h-full w-full sm:h-[auto] sm:w-[460px]"
        content-class="px-2! sm:px-[--n-padding-left]!"
      >
        <div class="px-4 pt-4 relative">
          <n-h1>
            {{ route.path === '/account/reg' ? t('registerTitle') : t('recoverTitle') }}
          </n-h1>
          <router-view></router-view>
          <div class="flex flex-row items-center">
            <n-text depth="3" class="text-xs">{{ t('hasAccount') }}</n-text>
            <router-link to="/login" class="text-xs">
              <n-text type="primary">{{ t('goToLogin') }} ></n-text>
            </router-link>
          </div>
        </div>
      </n-card>
    </div>
  </n-layout>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
definePage({
  meta: {
    authRequired: false,
    layout: 'empty',
  },
})
const route = useRoute()
</script>

<i18n lang="yaml">
zh:
  registerTitle: 注册账号
  recoverTitle: 找回密码
  hasAccount: 已有账号，
  goToLogin: 前往登录
en:
  registerTitle: Create account
  recoverTitle: Recover password
  hasAccount: 'Already have an account? '
  goToLogin: Log in
</i18n>
