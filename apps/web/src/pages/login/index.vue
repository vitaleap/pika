<template>
  <n-layout position="absolute">
    <div class="flex flex-row h-full w-full items-center justify-center">
      <n-card
        class="h-full w-full sm:h-[auto] sm:w-[460px]"
        content-class="px-2! sm:px-[--n-padding-left]!"
      >
        <div
          :class="{
            'p-4': hasOtherLoginType,
            'px-4 pt-4': !hasOtherLoginType,
          }"
        >
          <header-view></header-view>
          <n-tabs type="line">
            <template v-for="(loginType, idx) in config.auth.loginTypes" :key="idx">
              <n-tab-pane
                v-if="loginType === 'password'"
                name="password"
                :tab="t('passwordLogin')"
                display-directive="show:lazy"
              >
                <password-view @ok="handleLoginOk"></password-view>
              </n-tab-pane>
              <n-tab-pane
                v-else-if="loginType === 'phone_code'"
                name="phone"
                :tab="t('phoneLogin')"
                display-directive="show:lazy"
              >
                <phone-code-view @ok="handleLoginOk"></phone-code-view>
              </n-tab-pane>
              <n-tab-pane
                v-else-if="loginType === 'email_code'"
                name="email"
                :tab="t('emailLogin')"
                display-directive="show:lazy"
              >
                <email-code-view @ok="handleLoginOk"></email-code-view>
              </n-tab-pane>
            </template>
          </n-tabs>

          <!-- 注册账号 -->
          <div
            class="flex flex-row gap-2 justify-between"
            :class="{
              'mb-2': hasOtherLoginType,
            }"
          >
            <div>
              <template v-if="config.auth.regEnabled">
                <n-text depth="3" class="text-xs">{{ t('noAccount') }}</n-text>
                <router-link to="/account/reg" class="text-xs">
                  <n-text type="primary">{{ t('registerNow') }} ></n-text>
                </router-link>
              </template>
            </div>
            <div>
              <n-text depth="3" class="text-xs">{{ t('forgotPassword') }}</n-text>
              <router-link to="/account/forget" class="text-xs">
                <n-text type="primary">{{ t('recoverNow') }} ></n-text>
              </router-link>
            </div>
          </div>

          <!-- 其他登录方式 -->
          <div v-if="hasOtherLoginType">
            <n-divider style="margin-top: 0">
              <n-text :depth="3" class="text-sm">{{ t('otherMethods') }}</n-text>
            </n-divider>
          </div>
        </div>
      </n-card>
    </div>
  </n-layout>
</template>
<script setup lang="ts">
import HeaderView from './components/header.vue'
import PasswordView from './components/password.vue'
import PhoneCodeView from './components/phone-code.vue'
import EmailCodeView from './components/email-code.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const { config } = useConfigStore()
const hasOtherLoginType = computed(() => {
  return false
  // return config.auth.loginTypes.includes('passkey') && supportPasskey.value
})

const route = useRoute()
const router = useRouter()
const handleLoginOk = async () => {
  router.replace((route.query.redirect as string) || '/dashboard')
}

definePage({
  meta: {
    authRequired: false,
    layout: 'empty',
  },
})
</script>

<style>
.n-tab-pane {
  @apply: !pt-6;
}
</style>

<i18n lang="yaml">
zh:
  passwordLogin: 密码登录
  phoneLogin: 手机号登录
  emailLogin: 邮箱登录
  noAccount: 还没有账号？
  registerNow: 立即注册
  forgotPassword: 忘记密码？
  recoverNow: 前往找回
  otherMethods: 其他方式
en:
  passwordLogin: Password
  phoneLogin: Phone code
  emailLogin: Email code
  noAccount: 'No account? '
  registerNow: Register
  forgotPassword: 'Forgot password? '
  recoverNow: Recover
  otherMethods: Other methods
</i18n>
