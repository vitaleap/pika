import type { MenuOption } from '@/components/menu-group/menu-group.vue'
import { NIcon } from 'naive-ui'
import { defineStore } from 'pinia'
import { useI18n } from 'vue-i18n'
import type { LocaleMessages } from '@/utils/i18n'

const messages: LocaleMessages = {
  zh: {
    console: '控制台',
    backToConsole: '返回控制台',
    home: '首页',
    systemManagement: '系统管理',
    userManagement: '用户管理',
    loginLog: '登录日志',
    systemConfig: '系统配置',
  },
  en: {
    console: 'Dashboard',
    backToConsole: 'Back to dashboard',
    home: 'Home',
    systemManagement: 'System',
    userManagement: 'Users',
    loginLog: 'Login logs',
    systemConfig: 'System settings',
  },
}

type MenuGroup = {
  title: string
  options: MenuOption[]
}

export const useMenuStore = defineStore('menu', () => {
  const { t } = useI18n({ useScope: 'isolated', messages })
  const menus = computed<MenuGroup[]>(() => [
    {
      title: '',
      options: [
        {
          label: t('console'),
          url: '/dashboard',
          icon: <NIcon class="i-icon-park-outline-dashboard-one" />,
        },
      ],
    },
  ])

  const adminMenus = computed<MenuGroup[]>(() => [
    {
      title: '',
      options: [
        {
          label: t('backToConsole'),
          url: '/dashboard',
          icon: <NIcon class="i-icon-park-outline-return -mt-0.3" />,
        },
        {
          label: t('home'),
          url: '/admin',
          icon: <NIcon class="i-carbon:home" />,
        },
      ],
    },
    {
      title: t('systemManagement'),
      options: [
        {
          label: t('userManagement'),
          url: '/admin/user',
          icon: <NIcon class="i-icon-park-outline-user"></NIcon>,
        },
        {
          label: t('loginLog'),
          url: '/admin/login-log',
          icon: <NIcon class="i-icon-park-outline-log"></NIcon>,
        },
        {
          label: t('systemConfig'),
          url: '/admin/config',
          icon: <NIcon class="i-icon-park-outline-setting-config"></NIcon>,
        },
      ],
    },
  ])

  return {
    menus,
    adminMenus,
  }
})
