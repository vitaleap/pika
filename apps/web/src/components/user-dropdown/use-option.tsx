import { useUserStore } from '@/stores/user'
import { NIcon } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { LocaleMessages } from '@/utils/i18n'
import type { DropdownMixedOption } from 'naive-ui/es/dropdown/src/interface'

const messages: LocaleMessages = {
  zh: {
    profile: '个人中心',
    appearance: '外观',
    admin: '管理后台',
    logout: '退出登录',
  },
  en: {
    profile: 'Profile',
    appearance: 'Appearance',
    admin: 'Admin manager',
    logout: 'Log out',
  },
}

export const useOption = () => {
  const userStore = useUserStore()
  const themeStore = useThemeStore()
  const preferenceStore = usePreferenceStore()
  const { t } = useI18n()
  const { t: localT } = useI18n({ useScope: 'isolated', messages })
  const themeIcon = (themeMode?: ThemeMode) => () => {
    if (themeMode === 'light') {
      return <NIcon class="i-ph-sun"></NIcon>
    }
    if (themeMode === 'dark') {
      return <NIcon class="i-ph-moon"></NIcon>
    }
    return <NIcon class="i-mdi-theme-light-dark"></NIcon>
  }
  const selectedLabel = (label: string, selected: boolean) => () => (
    <div class="flex flex-row items-center gap-4">
      {label}
      {selected ? <NIcon class="i-mdi-check"></NIcon> : undefined}
    </div>
  )
  const options = computed<DropdownMixedOption[]>(() => {
    const menus: DropdownMixedOption[] = [
      {
        label: localT('profile'),
        key: '/dashboard/setting',
        icon: () => <NIcon class="i-ion-person-outline"></NIcon>,
      },
      {
        key: 'theme',
        label: localT('appearance'),
        icon: themeIcon(themeStore.themeMode),
        children: [
          {
            key: 'theme-system',
            label: selectedLabel(t('common.automatic'), themeStore.themeMode === 'system'),
            icon: themeIcon('system'),
          },
          {
            key: 'theme-light',
            label: selectedLabel(t('common.light'), themeStore.themeMode === 'light'),
            icon: themeIcon('light'),
          },
          {
            key: 'theme-dark',
            label: selectedLabel(t('common.dark'), themeStore.themeMode === 'dark'),
            icon: themeIcon('dark'),
          },
        ],
      },
      {
        key: 'locale',
        label: t('common.language'),
        icon: () => <NIcon class="i-mdi-translate"></NIcon>,
        children: [
          {
            key: 'locale-system',
            label: selectedLabel(t('common.automatic'), preferenceStore.language === 'system'),
          },
          {
            key: 'locale-zh',
            label: selectedLabel(t('common.chinese'), preferenceStore.language === 'zh'),
          },
          {
            key: 'locale-en',
            label: selectedLabel(t('common.english'), preferenceStore.language === 'en'),
          },
        ],
      },
    ]
    if (userStore.user.roles?.includes('admin')) {
      menus.push(
        { type: 'divider' },
        {
          label: localT('admin'),
          key: '/admin',
          icon: () => <NIcon class="i-mdi-desktop-mac"></NIcon>,
        },
        { type: 'divider' },
      )
    }
    menus.push({
      label: () => <div class="text-red-400">{localT('logout')}</div>,
      key: 'logout',
      icon: () => <NIcon class="i-mdi-logout text-red-400"></NIcon>,
    })
    return menus
  })

  return {
    options,
  }
}
