<template>
  <div class="multi-factor flex flex-col gap-2">
    <div class="multi-factor__title">{{ t('title') }}</div>

    <n-card content-class="py-2!">
      <np-cell-group bordered :options="options"></np-cell-group>
    </n-card>

    <!-- 添加身份验证器：先扫码，再输入动态码确认 -->
    <n-modal
      v-model:show="setupVisible"
      preset="card"
      :title="t('authenticator')"
      style="width: 460px"
      :mask-closable="false"
      :close-on-esc="false"
      :auto-focus="false"
    >
      <div>
        <div v-if="setupStep === 1" class="flex flex-col items-center gap-2">
          <!-- 静区由外层白底内边距提供：组件自身 padding 会与 border-box 冲突导致画布偏移 -->
          <div class="rounded-lg dark:bg-white p-4 flex">
            <n-qr-code :value="uri" :size="180" :padding="0"></n-qr-code>
          </div>
          <n-text depth="3" class="text-xs">{{ t('scanTip') }}</n-text>
          <n-input :value="secret" readonly size="small">
            <template #suffix>
              <np-button text type="primary" :click="() => copy(secret)">
                {{ t('copy') }}
              </np-button>
            </template>
          </n-input>
        </div>

        <div v-else class="flex flex-col gap-2">
          <n-text depth="3" class="text-xs">{{ t('confirmTip') }}</n-text>
          <n-input
            :value="code"
            :placeholder="t('codePlaceholder')"
            clearable
            @update:value="onCodeInput"
            @keyup.enter="confirmTotp"
          >
            <template #prefix>
              <n-icon class="i-mdi-shield-key"></n-icon>
            </template>
          </n-input>
        </div>
      </div>

      <template #footer>
        <div class="flex flex-row justify-end gap-2">
          <np-button size="small" :click="() => (setupVisible = false)">
            {{ t('cancel') }}
          </np-button>
          <np-button
            v-if="setupStep === 1"
            size="small"
            type="primary"
            :click="() => (setupStep = 2)"
          >
            {{ t('next') }}
          </np-button>
          <np-button v-else size="small" type="primary" :click="confirmTotp">
            {{ t('confirm') }}
          </np-button>
        </div>
      </template>
    </n-modal>

    <!-- 恢复码：必须复制或下载后才能完成添加 -->
    <n-modal
      v-model:show="codesVisible"
      preset="card"
      :title="t('recoveryCodeLabel')"
      style="width: 460px"
      :closable="false"
      :mask-closable="false"
      :close-on-esc="false"
    >
      <div class="flex flex-col gap-3">
        <n-text depth="3" class="text-xs">{{ t('codesTip') }}</n-text>
        <div class="multi-factor__codes">
          <code v-for="item in codes" :key="item">{{ item }}</code>
        </div>
        <div class="flex flex-row justify-end gap-2">
          <np-button size="small" :click="copyCodes">{{ t('copyAll') }}</np-button>
          <np-button size="small" :click="downloadCodes">{{ t('download') }}</np-button>
        </div>
      </div>
      <template #footer>
        <div class="flex flex-row items-center justify-between gap-2">
          <n-text depth="3" class="text-xs">
            {{ saved ? t('codesSaved') : t('codesNeedSave') }}
          </n-text>
          <div class="flex flex-row gap-2">
            <np-button size="small" :click="closeCodes">
              {{ t('cancel') }}
            </np-button>
            <np-button size="small" type="primary" :disabled="!saved" :click="confirmCodes">
              {{ t('done') }}
            </np-button>
          </div>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="tsx">
import type { NpCellGroupOption } from 'naive-plus'
import { useI18n } from 'vue-i18n'
import { formatTime } from '@/utils/date'

const { t } = useI18n()

const userStore = useUserStore()

/** 下载文件里展示的账号标识，邮箱优先，其次手机号 / 昵称 */
const account = computed(
  () => userStore.user.email || userStore.user.phone_number || userStore.user.nickname || '',
)

const enabled = ref(false)
const totp = ref(false)
const recoveryCode = ref(false)
const recoveryCodeCount = ref(0)

const setupVisible = ref(false)
const setupStep = ref(1)
const secret = ref('')
const uri = ref('')
const code = ref('')

const codesVisible = ref(false)
const codes = ref<string[]>([])
/** 当前展示批次的标识，确认时回传，避免双标签页保存的文件失效 */
const batchId = ref('')
/** 用户是否已复制或下载恢复码，未保存不允许完成 */
const saved = ref(false)

let latestStatusRequestId = 0

const loadStatus = async () => {
  const requestId = ++latestStatusRequestId
  const res = await Apis.multiFactor.getMultiFactor()
  if (requestId !== latestStatusRequestId) {
    return
  }
  enabled.value = res.enabled
  totp.value = res.totp
  recoveryCode.value = res.recoveryCode
  recoveryCodeCount.value = res.recoveryCodeCount
}

onMounted(loadStatus)

/** 复制文本，成功返回 true */
const copy = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text)
    window.$message.success(t('copied'))
    return true
  } catch {
    window.$message.error(t('copyFailed'))
    return false
  }
}

const copyCodes = async () => {
  const batch = codes.value
  // 剪贴板写入是异步的，期间可能已重新生成下一批，需确认仍是同一批再标记已保存
  if ((await copy(batch.join('\n'))) && codes.value === batch && codesVisible.value) {
    saved.value = true
  }
}

const downloadCodes = () => {
  // 说明行以 `#` 开头，验证时前端会剔除；服务端只认纯恢复码
  const content = [
    `# ${t('codesFileTip')}`,
    `# ${t('codesFileAccount', { account: account.value })}`,
    `# ${t('codesFileCreatedAt', { time: formatTime(Date.now()) })}`,
    '',
    ...codes.value,
  ].join('\n')
  const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'recovery-codes.txt'
  // 部分浏览器需要节点在文档中才会触发下载
  document.body.appendChild(link)
  link.click()
  link.remove()
  // 延迟回收，避免下载尚未开始就失效
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  saved.value = true
}

/**
 * 高危操作是否需要校验由后端判定，需要时抛 `SYSTEM.MULTI_FACTOR_REQUIRED`，
 * api 拦截器会弹窗校验并重试原请求。
 */
const toggleEnabled = async () => {
  if (!enabled.value && !totp.value) {
    window.$message.warning(t('needMethod'))
    return
  }
  const next = !enabled.value
  await Apis.multiFactor.toggleMultiFactor({ data: { enabled: next } })
  window.$message.success(next ? t('enableSuccess') : t('disableSuccess'))
  await loadStatus()
}

const addTotp = async () => {
  const res = await Apis.multiFactor.setupMultiFactorTotp({ data: {} })
  secret.value = res.secret
  uri.value = res.uri
  code.value = ''
  setupStep.value = 1
  setupVisible.value = true
}

/** 先去掉非数字再截断到 6 位；不能用原生 `maxlength`，否则粘贴 `167 626` 会先被截成 `167 62` */
const onCodeInput = (val: string) => {
  code.value = val.replace(/\D/g, '').slice(0, 6)
}

const confirmTotp = async () => {
  if (!code.value.trim()) {
    window.$message.warning(t('codeRequired'))
    return
  }
  await Apis.multiFactor.confirmMultiFactorTotp({ data: { code: code.value.trim() } })
  window.$message.success(t('addTotpSuccess'))
  setupVisible.value = false
  await loadStatus()
}

const removeTotp = async () => {
  const wasEnabled = enabled.value
  await Apis.multiFactor.removeMultiFactorTotp({ data: {} })
  await loadStatus()
  // 身份验证器是唯一可重复使用的验证方式，移除后后端会自动停用
  window.$message.success(
    wasEnabled && !enabled.value ? t('removeTotpDisabled') : t('removeSuccess'),
  )
}

const addRecoveryCodes = async () => {
  const res = await Apis.multiFactor.generateMultiFactorRecoveryCodes({ data: {} })
  batchId.value = res.batchId
  codes.value = res.codes
  saved.value = false
  codesVisible.value = true
}

/** 关闭弹窗并复位保存状态，下次打开需重新确认已保存 */
const closeCodes = () => {
  codesVisible.value = false
  saved.value = false
  batchId.value = ''
}

const confirmCodes = async () => {
  if (!saved.value) {
    return
  }
  try {
    await Apis.multiFactor.confirmMultiFactorRecoveryCodes({ data: { batchId: batchId.value } })
    window.$message.success(t('addCodesSuccess'))
  } finally {
    // 弹窗无法通过遮罩关闭，请求失败时也要能退出，避免用户卡在弹窗内
    closeCodes()
    await loadStatus()
  }
}

const removeRecoveryCodes = async () => {
  await Apis.multiFactor.removeMultiFactorRecoveryCodes({ data: {} })
  window.$message.success(t('removeSuccess'))
  await loadStatus()
}

const actionButton = (config: {
  text: string
  type?: 'primary' | 'error' | 'default'
  click: () => void | Promise<void>
}) => (
  <div class="flex flex-row gap-2 pl-2">
    <NpButton props={{ size: 'small' }} type={config.type ?? 'default'} click={config.click}>
      {config.text}
    </NpButton>
  </div>
)

const options = computed<NpCellGroupOption[]>(() => [
  {
    label: () => <span>{t('enableLabel')}</span>,
    icon: () => <NIcon class="i-mdi-shield-check"></NIcon>,
    description: () => <span>{enabled.value ? t('enableDescOn') : t('enableDescOff')}</span>,
    value: () =>
      actionButton({
        text: enabled.value ? t('disable') : t('enable'),
        type: enabled.value ? 'default' : 'primary',
        click: toggleEnabled,
      }),
  },
  {
    label: () => <span>{t('authenticator')}</span>,
    icon: () => <NIcon class="i-mdi-cellphone-key"></NIcon>,
    description: () => <span>{totp.value ? t('authenticatorDescOn') : t('notSet')}</span>,
    value: () =>
      totp.value
        ? actionButton({ text: t('remove'), type: 'error', click: removeTotp })
        : actionButton({ text: t('add'), type: 'primary', click: addTotp }),
  },
  {
    label: () => <span>{t('recoveryCodeLabel')}</span>,
    icon: () => <NIcon class="i-mdi-key-variant"></NIcon>,
    description: () => (
      <span>
        {recoveryCode.value
          ? t('recoveryCodeDescOn', { count: recoveryCodeCount.value })
          : t('notSet')}
      </span>
    ),
    value: () =>
      recoveryCode.value
        ? actionButton({ text: t('remove'), type: 'error', click: removeRecoveryCodes })
        : actionButton({ text: t('add'), type: 'primary', click: addRecoveryCodes }),
  },
])
</script>

<style lang="scss">
.multi-factor {
  &__title {
    @apply px-2 color-text-2 text-xs select-none pt-4;
  }

  &__codes {
    @apply grid gap-2 rounded-lg p-3 bg-[var(--color-bg-3)] font-mono text-size-sm;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

<i18n lang="yaml">
zh:
  title: 多因素验证
  enableLabel: 登录两步验证
  enableDescOn: 已启用，登录时需要进行两步验证
  enableDescOff: 未启用，登录时无需进行两步验证
  enable: 启用
  disable: 停用
  enableSuccess: 两步验证已启用
  disableSuccess: 两步验证已停用
  authenticator: 身份验证器
  authenticatorDescOn: 已添加，登录时输入动态码
  recoveryCodeLabel: 恢复码
  recoveryCodeDescOn: 剩余 {count} 次
  notSet: 未添加
  add: 添加
  remove: 移除
  removeSuccess: 已移除
  removeTotpDisabled: 身份验证器已移除，两步验证已自动关闭
  needMethod: 请先添加身份验证器，恢复码只能作为备份
  addTotpSuccess: 身份验证器已添加
  addCodesSuccess: 恢复码已添加
  scanTip: 使用验证器 App（如 Google Authenticator）扫描二维码，或手动输入密钥
  confirmTip: 输入验证器 App 中显示的 6 位动态码，验证通过后才会添加
  codePlaceholder: 输入 6 位动态码
  codeRequired: 请输入验证码
  next: 下一步
  copy: 复制
  copyAll: 复制全部
  download: 下载
  copied: 已复制
  copyFailed: 复制失败，请手动选择复制或下载
  confirm: 确定
  cancel: 取消
  done: 完成
  codesTip: 恢复码用于丢失验证器时登录，请完整保存；验证时完整输入即可
  codesNeedSave: 请先复制或下载恢复码
  codesSaved: 已保存，可完成添加
  codesFileTip: 请务必将恢复码保存在一个安全的地方
  codesFileAccount: 生成账号：{account}
  codesFileCreatedAt: 生成时间：{time}
en:
  title: Multi-factor
  enableLabel: Two-step verification at sign-in
  enableDescOn: Enabled. Two-step verification is required when signing in
  enableDescOff: Disabled. Two-step verification is not required when signing in
  enable: Enable
  disable: Disable
  enableSuccess: Two-step verification enabled
  disableSuccess: Two-step verification disabled
  authenticator: Authenticator
  authenticatorDescOn: Added. Enter the code when signing in
  recoveryCodeLabel: Recovery codes
  recoveryCodeDescOn: '{count} times'
  notSet: Not set
  add: Add
  remove: Remove
  removeSuccess: Removed
  removeTotpDisabled: Authenticator removed. Two-step verification has been disabled
  needMethod: Set up an authenticator first. Recovery codes only serve as a backup
  addTotpSuccess: Authenticator added
  addCodesSuccess: Recovery codes added
  scanTip: Scan the QR code with an authenticator app (e.g. Google Authenticator), or enter the secret manually
  confirmTip: Enter the 6-digit code from your authenticator app to finish adding
  codePlaceholder: Enter the 6-digit code
  codeRequired: Enter the code
  next: Next
  copy: Copy
  copyAll: Copy all
  download: Download
  copied: Copied
  copyFailed: Copy failed, please select and copy manually, or download instead
  confirm: OK
  cancel: Cancel
  done: Done
  codesTip: Recovery codes can be used to sign in if you lose your authenticator. Save them all, and enter them all when verifying
  codesNeedSave: Copy or download the recovery codes first
  codesSaved: Saved, you can finish now
  codesFileTip: Keep these recovery codes in a safe place
  codesFileAccount: 'Account: {account}'
  codesFileCreatedAt: 'Generated at: {time}'
</i18n>
