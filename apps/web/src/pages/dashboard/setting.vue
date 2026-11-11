<template>
  <div v-if="isIndex" class="setting-index">
    <div class="setting-profile">
      <w-avatar :src="userStore.user.picture" :text="userStore.user.name" :size="96" round />
      <div class="setting-profile__name">{{ userStore.user.name }}</div>
      <div class="setting-profile__account">{{ account }}</div>
    </div>
    <div v-for="menu in menus" :key="menu.title">
      <div class="px-2 pb-1 color-text-2 text-xs select-none">{{ menu.title }}</div>
      <np-cell-group class="setting-menu" bordered :options="menu.options"></np-cell-group>
    </div>
  </div>
  <router-view v-else></router-view>
</template>
<script setup lang="tsx">
import { i18nTitle } from '@/utils/i18n-title'
import type { NpCellGroupOption } from 'naive-plus'
import { useI18n } from 'vue-i18n'

definePage({
  meta: {
    title: i18nTitle('pageTitle.setting'),
  },
})

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const isIndex = computed(() => route.path === '/dashboard/setting')
const account = computed(() => userStore.user.email || userStore.user.phone_number || '')

const buildMenu = (label: string, icon: string, url: string): NpCellGroupOption => ({
  label,
  icon: () => (
    <span class="setting-menu__icon">
      <NIcon class={icon}></NIcon>
    </span>
  ),
  arrow: true,
  hover: true,
  onClick: () => router.push(url),
})

const menus = computed<{ title: string; options: NpCellGroupOption[] }[]>(() => [
  {
    title: t('general'),
    options: [
      buildMenu(t('profile'), 'i-ion-person-outline', '/dashboard/setting/profile'),
      buildMenu(t('security'), 'i-mdi-shield-key-outline', '/dashboard/setting/security'),
    ],
  },
  {
    title: t('preference'),
    options: [
      buildMenu(t('appearance'), 'i-mdi-palette-outline', '/dashboard/setting/appearance'),
      buildMenu(t('languageTimezone'), 'i-mdi-translate', '/dashboard/setting/language'),
    ],
  },
])
</script>
<style lang="scss" scoped>
.setting-index {
  @apply flex flex-col gap-6 py-6;
}

.setting-profile {
  @apply flex flex-col items-center gap-1;

  &__name {
    @apply mt-2 text-size-lg font-semibold;
  }

  &__account {
    @apply text-size-sm color-text-2;
  }
}

.setting-menu {
  @apply overflow-hidden rounded-xl bg-[var(--color-bg-2)];
  border: 1px solid var(--color-border);
  :deep(.np-cell) {
    --np-cell-padding-x: 12px;
    --np-cell-padding-y: 12px;
    --np-cell-radius: 0;
    --np-cell-color-hover: var(--color-hover);
    --np-cell-border-color: var(--color-border);
    --np-cell-control-gap: 12px;
  }

  :deep(.setting-menu__icon) {
    @apply flex items-center justify-center w-7 h-7 rounded-lg;
    @apply bg-[var(--color-bg-3)] color-text-2 text-size-lg;
  }
}
</style>

<i18n lang="yaml">
zh:
  general: 常规
  preference: 偏好设定
  profile: 个人信息
  security: 登录与安全性
  appearance: 外观
  languageTimezone: 语言与时区
en:
  general: General
  preference: Preferences
  profile: Personal Information
  security: Sign-in & Security
  appearance: Appearance
  languageTimezone: Language & Time zone
</i18n>
