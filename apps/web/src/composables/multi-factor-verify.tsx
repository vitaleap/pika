import {
  NpButton,
  NpForm,
  type FormColumn,
  type FormOption,
  type FormInst,
  type Rule,
} from 'naive-plus'
import { NInput } from 'naive-ui'
import { FALLBACK_LOCALE, i18n, isAppLocale, type LocaleMessages } from '@/utils/i18n'

/** 多因素验证方式，与后端 `multiFactorTypes` 保持一致 */
export type MultiFactorType = 'totp' | 'recovery_code'

/** 校验结果，高危操作接口统一接收 `{ type, value }` */
export type MultiFactorVerify = { type: MultiFactorType; value: string }

/** 校验结果，`ok: false` 表示用户取消 */
export type MultiFactorVerifyResult = { ok: true; data: unknown } | { ok: false }

/** 剔除下载文件里的说明行（以 `#` 开头），服务端只接受纯恢复码 */
const stripFileHeader = (value: string) =>
  value
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n')

/** 按验证方式归一化输入：恢复码剔除文件说明行，动态码去掉多余字符 */
const normalizeValue = (type: MultiFactorType, value: string): string =>
  type === 'recovery_code' ? stripFileHeader(value).trim() : value.trim()

type Opts = {
  /** 允许展示的验证类型；仅决定「显不显示」，顺序固定为「身份验证器 > 恢复码」 */
  types?: MultiFactorType[]
  /** 校验并执行操作，抛错时错误信息展示在表单校验反馈中，弹窗保持开启 */
  submit: (payload: MultiFactorVerify) => Promise<unknown>
}

type MultiFactorForm = { type: MultiFactorType; value: string }

/** 固定的展示顺序：身份验证器优先，其次恢复码 */
const TYPE_ORDER: MultiFactorType[] = ['totp', 'recovery_code']

const messages: LocaleMessages = {
  zh: {
    title: '安全验证',
    totp: '身份验证器',
    recovery_code: '恢复码',
    totpPlaceholder: '输入 6 位动态码',
    recoveryCodePlaceholder: '输入完整的恢复码',
    valueRequired: '请输入',
    confirm: '验证',
    cancel: '取消',
  },
  en: {
    title: 'Security verification',
    totp: 'Authenticator',
    recovery_code: 'Recovery code',
    totpPlaceholder: 'Enter the 6-digit code',
    recoveryCodePlaceholder: 'Enter the complete recovery code',
    valueRequired: 'Enter please',
    confirm: 'Verify',
    cancel: 'Cancel',
  },
}

/** 文案不依赖组件上下文，按当前语言取词，便于 api 层直接调用 */
const t = (key: string) => {
  const locale = i18n.global.locale.value
  return (isAppLocale(locale) ? messages[locale] : messages[FALLBACK_LOCALE])[key] ?? key
}

/**
 * 多因素校验弹窗。
 *
 * 一般无需直接调用：接口返回 `SYSTEM.MULTI_FACTOR_REQUIRED` 时，
 * `src/api/index.ts` 的拦截器会弹出本弹窗，拿到结果后自动重试原请求。
 * 弹窗通过 App.vue 注入的 `window.$modal` 创建，因此可在 api 层等非组件上下文调用。
 */
export const verifyMultiFactor = (opts: Opts): Promise<MultiFactorVerifyResult> => {
  const modal = window.$modal
  // 弹窗容器在 App.vue mounted 后才注入，启动阶段的请求不会要求第二因素
  if (!modal) {
    return Promise.resolve({ ok: false })
  }

  // 只保留允许展示的类型；顺序固定，不受调用方传入顺序影响
  const allowed = opts.types?.length ? opts.types : TYPE_ORDER
  const types = TYPE_ORDER.filter((type) => allowed.includes(type))
  const model: MultiFactorForm = { type: types[0] ?? TYPE_ORDER[0]!, value: '' }
  /** 当前验证方式，用于切换输入控件类型 */
  const currentType = ref<MultiFactorType>(model.type)
  /** 校验进行中：阻止重复提交与关闭弹窗 */
  const submitting = ref(false)
  const formRef = ref<FormInst>()

  /** 输入框：`np-form-item` 的 type 在 setup 时固定，只能按当前验证方式动态渲染 */
  const renderValue = (data: MultiFactorForm) =>
    currentType.value === 'totp' ? (
      <NInput
        key="totp"
        value={data.value}
        maxlength={10}
        placeholder={t('totpPlaceholder')}
        inputProps={{
          // 标记为一次性验证码字段，供 Bitwarden 等系统自动填充识别
          name: 'totp',
          autocomplete: 'one-time-code',
          inputmode: 'numeric',
          pattern: '[0-9]*',
          enterkeyhint: 'done',
        }}
        style="--n-padding-right:0;"
        onUpdateValue={(value: string) => {
          // 兼容 `167 626` 这类带空格的粘贴，只保留 6 位数字
          data.value = value.replace(/\D/g, '').slice(0, 6)
        }}
        onKeyup={(event: KeyboardEvent) => {
          if (event.key === 'Enter') {
            void formRef.value?.submit()
          }
        }}
      />
    ) : (
      <NInput
        key="recovery_code"
        type="textarea"
        value={data.value}
        rows={3}
        placeholder={t('recoveryCodePlaceholder')}
        onUpdateValue={(value: string) => {
          data.value = value
        }}
      />
    )

  const valueRule: Rule = {
    trigger: ['input', 'blur'],
    // 必须用 async：naive-ui 同步抛错的 validator 会中断校验流程，导致提交无响应
    validator: async (value: string) => {
      if (!value?.trim()) {
        throw new Error(t('valueRequired'))
      }
    },
  }

  return new Promise((resolve) => {
    let settled = false
    const finish = (result: MultiFactorVerifyResult) => {
      if (settled) {
        return
      }
      settled = true
      resolve(result)
      inst.destroy()
    }

    const columns: FormColumn<MultiFactorForm>[] = []
    if (types.length > 1) {
      columns.push({
        key: 'type',
        type: 'radio',
        formItemProps: {
          feedbackStyle: {
            minHeight: '12px',
          },
        },
        options: types.map((item) => ({ label: t(item), value: item })),
        onChange: (value, ctx) => {
          currentType.value = value as MultiFactorType
          // 切换验证方式后清空上一次的输入
          ctx.setData({ ...ctx.data, value: '' })
        },
      })
    }
    columns.push({ key: 'value', type: renderValue, rule: valueRule })

    const option: FormOption<MultiFactorForm> = {
      props: { showLabel: false },
      columns,
      onSubmit: async (form) => {
        submitting.value = true
        try {
          const data = await opts.submit({
            type: form.type,
            value: normalizeValue(form.type, form.value),
          })
          finish({ ok: true, data })
        } finally {
          submitting.value = false
        }
      },
      footer: {
        align: 'right',
        submitBtn: { text: t('confirm') },
        resetBtn: false,
        suffixRender: () => (
          <NpButton
            props={{ quaternary: true, disabled: submitting.value }}
            click={() => finish({ ok: false })}
          >
            {t('cancel')}
          </NpButton>
        ),
      },
    }

    const inst = modal.create({
      title: t('title'),
      preset: 'card',
      autoFocus: false,
      closeOnEsc: false,
      onEsc: () => {
        if (!submitting.value) {
          finish({ ok: false })
        }
      },
      maskClosable: false,
      transformOrigin: 'center',
      style: { width: 'auto' },
      contentClass: 'md:w-[420px] xs:w-[420px] w-[94vw] pb-0!',
      bordered: false,
      content: () => <NpForm ref={formRef} modelValue={model} option={option} />,
      onClose: () => {
        // 校验进行中不允许关闭，避免请求已成功但弹窗被取消
        if (submitting.value) {
          return false
        }
        finish({ ok: false })
        return true
      },
      onMaskClick: () => {
        if (!submitting.value) {
          finish({ ok: false })
        }
      },
    })
  })
}
