import { NButton, NIcon } from 'naive-ui'
import { h } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LocaleMessages } from '@/utils/i18n'

const messages: LocaleMessages = {
  zh: {
    available: '发现新版本，点击获取最新版本。',
    refresh: '刷新',
  },
  en: {
    available: 'A new version is available. Refresh to update.',
    refresh: 'Refresh',
  },
}

let timer: number | undefined
/**
 * 版本更新监听器，当有新版本，右上角弹出消息通知
 * @param intervalSeconds 检查间隔，单位秒，默认5分钟
 */
export const useUpdateListener = (intervalSeconds = 5 * 60) => {
  const { t } = useI18n({ useScope: 'isolated', messages })
  if (timer !== undefined || !import.meta.env.PROD) {
    return
  }
  const showNotification = () => {
    const inst = window.$notification.create({
      content: t('available'),
      meta: ' ',

      action: () =>
        h(
          NButton,
          {
            size: 'small',
            // text: true,
            tertiary: true,
            // type: 'primary',
            onClick: () => {
              window.location.reload()
            },
          },
          {
            default: () => h('span', t('refresh')),
          },
        ),
      onClose() {
        inst.destroy()
      },
    })
  }
  // For test
  // nextTick(() => {
  //   showNotification()
  // })
  let indexJs: string
  timer = setInterval(async () => {
    const response = await fetch(`/.vite/manifest.json?t=${Date.now()}`)
    const manifest = await response.json()
    let file
    try {
      file = manifest['index.html'].file
    } catch {
      return
    }
    if (!indexJs) {
      indexJs = file
    }
    if (indexJs === file) {
      return
    }
    clearInterval(timer)
    showNotification()
  }, intervalSeconds * 1000)
}
