import { useModal } from 'naive-ui'
import { NpCellGroup } from 'naive-plus'
import { useI18n } from 'vue-i18n'
import type { LocaleMessages } from '@/utils/i18n'

const messages: LocaleMessages = {
  zh: {
    title: '选择',
    confirm: '确定',
    cancel: '取消',
  },
  en: {
    title: 'Select',
    confirm: 'Confirm',
    cancel: 'Cancel',
  },
}

type Opts = {
  type?: 'radio' | 'checkbox' | 'switch'
  title?: string
  confirmText?: string
  options: {
    key: string
    label: string
    data?: unknown
  }[]
  onConfirm: (
    selected: string[],
    options: {
      key: string
      label: string
      data?: unknown
    }[],
  ) => boolean | Promise<boolean>
  cancelText?: string
  onCancel?: () => void
}

export const useSelectModal = () => {
  const modal = useModal()
  const { t } = useI18n({
    useScope: 'isolated',
    messages,
  })

  onUnmounted(() => {
    modal.destroyAll()
  })

  const show = (opts: Opts) => {
    const selected = ref<string[]>([])
    const inst = modal.create({
      title: opts.title || t('title'),
      showIcon: false,
      preset: 'confirm',
      content: () => {
        return (
          <div class="max-h-[50vh] overflow-y-auto">
            <NpCellGroup
              onUpdate:keys={(val) => (selected.value = val as string[])}
              type={opts.type ?? 'checkbox'}
              options={opts.options.map((item) => {
                return {
                  ...item,
                  hover: true,
                }
              })}
            ></NpCellGroup>
          </div>
        )
      },
      autoFocus: false,
      transformOrigin: 'center',
      positiveText: opts.confirmText || t('confirm'),
      onPositiveClick: async () => {
        inst.loading = true
        try {
          const res = await opts.onConfirm(
            selected.value,
            opts.options.filter((item) => selected.value.includes(item.key)),
          )
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
        inst.destroy()
      },
    })
  }

  return {
    show,
  }
}
