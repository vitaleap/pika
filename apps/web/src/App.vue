<template>
  <n-config-provider
    :theme="configProviderProps.theme"
    :theme-overrides="configProviderProps.themeOverrides"
    :locale="configProviderProps.locale"
    :date-locale="configProviderProps.dateLocale"
    class="h-full w-full"
  >
    <n-global-style />
    <n-message-provider>
      <n-notification-provider>
        <n-modal-provider>
          <n-dialog-provider>
            <np-config-provider :locale="locale" :component-options="npComponentOptions">
              <w-config-provider :component-options="componentOptions">
                <router-view></router-view>
              </w-config-provider>
            </np-config-provider>
          </n-dialog-provider>
        </n-modal-provider>
      </n-notification-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { createDiscreteApi } from 'naive-ui'
import { useGlobalUpload } from '@/composables/use-global-upload'
import type { WComponentOptions } from '@pika/wrap-naive-ui'
import type { NpComponentOptions } from 'naive-plus'

useUpdateListener()

// 注入 w-upload / w-avatar-upload 的全局默认 customRequest
const componentOptions = computed<WComponentOptions>(() => ({
  Upload: { customRequest: useGlobalUpload() },
}))

const userStore = useUserStore()
if (userStore.isLogin) {
  userStore.userinfo(false)
}

const { configProviderProps, primaryColor } = storeToRefs(useThemeConfigStore())
const { locale } = storeToRefs(useLocaleStore())

// html 上的主题色变量供普通 CSS / scoped 样式使用，随主题色实时同步
watchEffect(() => {
  document.documentElement.style.setProperty('--n-primary-color', primaryColor.value.color)
})

onMounted(() => {
  const { message, notification, loadingBar } = createDiscreteApi(
    ['message', 'notification', 'loadingBar'],
    { configProviderProps },
  )
  window.$message = message
  window.$notification = notification
  window.$loadingBar = loadingBar
})

// np config provider
const npComponentOptions = ref<NpComponentOptions>({
  Table: {
    operation: {
      fixed: 'right',
      width: 52,
    },
  },
})
</script>

<style>
html {
  --n-bg-color: #fff;
}

html[theme-mode='dark'] {
  --n-bg-color: #18181c;
}
</style>
