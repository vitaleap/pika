import { NButton, NInput, useModal } from 'naive-ui'
import type { VNodeChild } from 'vue'
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
  title?: string
  content?: string | (() => VNodeChild)
  placeholder?: string
  defaultValue?: string
  maxlength?: number
  confirmText?: string
  cancelText?: string
  /**
   * 返回值：
   * - `true`：关闭弹窗
   * - `false`：保留弹窗（例如校验失败）
   */
  onConfirm: (value: string) => boolean | Promise<boolean>
}

/**
 * 带输入框的确认弹窗
 * - 与 useConfirmModal 风格一致
 * - 内部使用 NModal + NInput，避免每次使用方自己写模板
 */
export const useInputModal = () => {
  const modal = useModal()
  const { t } = useI18n({
    useScope: 'isolated',
    messages,
  })

  onUnmounted(() => {
    modal.destroyAll()
  })

  const show = (opts: Opts) => {
    const inputValue = ref(opts.defaultValue ?? '')
    const renderContent = () => (
      <div class="flex flex-col gap-3">
        {opts.content && (
          <div class="color-text-2 text-size-xs">
            {typeof opts.content === 'string' ? opts.content : opts.content()}
          </div>
        )}
        <NInput
          value={inputValue.value}
          placeholder={opts.placeholder}
          maxlength={opts.maxlength ?? 100}
          showCount
          onUpdateValue={(val: string) => {
            inputValue.value = val
          }}
        />
        <div class="flex flex-row justify-end gap-2">
          <NButton quaternary onClick={() => inst.destroy()}>
            {opts.cancelText || t('cancel')}
          </NButton>
          <NButton
            type="primary"
            loading={inst.loading}
            onClick={async () => {
              inst.loading = true
              try {
                const ok = await opts.onConfirm(inputValue.value.trim())
                if (ok) {
                  inst.destroy()
                } else {
                  inst.loading = false
                }
              } catch {
                inst.loading = false
              }
            }}
          >
            {opts.confirmText || t('confirm')}
          </NButton>
        </div>
      </div>
    )
    const inst = modal.create({
      type: opts.type,
      title: opts.title,
      preset: 'card',
      autoFocus: false,
      transformOrigin: 'center',
      style: { width: '420px' },
      bordered: false,
      content: renderContent,
    })
  }

  return {
    show,
  }
}
