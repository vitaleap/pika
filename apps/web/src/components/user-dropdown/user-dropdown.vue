<template>
  <n-dropdown
    class="min-w-40"
    trigger="click"
    placement="bottom-start"
    :options="options"
    @select="handleSelect"
  >
    <slot></slot>
  </n-dropdown>
</template>
<script setup lang="tsx">
import { useOption } from './use-option'
import { isAppLocale } from '@/utils/i18n'

const userStore = useUserStore()
const { options } = useOption()
const router = useRouter()
const preferenceStore = usePreferenceStore()
const themeStore = useThemeStore()

const handleSelect = (key: string) => {
  if (key === 'logout') {
    userStore.logout()
    router.push('/login')
    return
  }
  if (key.startsWith('/')) {
    router.push(key)
    return
  }
  if (key.startsWith('locale-')) {
    const locale = key.substring('locale-'.length)
    if (locale === 'system' || isAppLocale(locale)) {
      preferenceStore.setLanguage(locale)
    }
    return
  }
  if (key.startsWith('theme')) {
    themeStore.setTheme(key.substring('theme-'.length) as ThemeMode)
  }
}
</script>
