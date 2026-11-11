import { useModal } from 'naive-ui'
import type { CSSProperties, VNodeChild } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LocaleMessages } from '@/utils/i18n'

const messages: LocaleMessages = {
  zh: {
    confirm: '确定',
    cancel: '取消',
  },
  en: {
    confirm: 'Confirm',
    cancel: 'Cancel',
  },
}

type Opts = {
  type?: 'default' | 'info' | 'success' | 'warning' | 'error'
  title?: string | (() => VNodeChild)
  content?: string | (() => VNodeChild)
  confirmText?: string
  onConfirm: () => boolean | Promise<boolean>
  cancelText?: string
  onCancel?: () => void
  /** 对话框以任意方式关闭时触发（确认 / 取消 / 关闭按钮 / 遮罩） */
  onClose?: () => void
  /** 弹窗容器样式：例如 { width: '480px' } 用于内容量大的弹窗，避免每个弹窗都写全局 CSS */
  style?: CSSProperties
}

export const useConfirmModal = () => {
  const modal = useModal()
  const { t } = useI18n({
    useScope: 'isolated',
    messages,
  })

  onUnmounted(() => {
    modal.destroyAll()
  })

  const show = (opts: Opts) => {
    const inst = modal.create({
      type: opts.type,
      title: opts.title,
      preset: 'confirm',
      content: opts.content,
      autoFocus: false,
      transformOrigin: 'center',
      positiveText: opts.confirmText || t('confirm'),
      style: opts.style,
      onPositiveClick: async () => {
        inst.loading = true
        try {
          const res = await opts.onConfirm()
          if (!res) {
            inst.loading = false
          }
          return res
        } catch {
          inst.loading = false
          return false
        }
      },
      negativeText: opts.cancelText || t('cancel'),
      negativeButtonProps: { type: 'default', ghost: false, secondary: true },
      onNegativeClick: () => {
        opts.onCancel?.()
      },
      onClose: () => {
        opts.onClose?.()
        inst.destroy()
      },
    })
    return inst
  }

  return {
    show,
  }
}
