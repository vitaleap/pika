<template>
  <div class="p-4 mx-auto max-w-3xl flex flex-col">
    <div class="admin-config">
      <n-spin :show="loading">
        <n-card content-class="py-2!">
          <np-cell-group bordered :options="options"></np-cell-group>
        </n-card>
      </n-spin>
    </div>
  </div>
</template>

<script setup lang="tsx">
import type { FormInst, FormOption, NpCellGroupOption } from 'naive-plus'
import type { FileForm, MailForm } from './config/composables'
import { useAuth } from './config/auth'
import { useMail } from './config/mail'
import { useFile } from './config/file'
import { cloneDeep } from 'es-toolkit'
import { useI18n } from 'vue-i18n'
import { i18nTitle } from '@/utils/i18n-title'

const { t } = useI18n()

definePage({
  meta: {
    title: i18nTitle('pageTitle.systemConfig'),
  },
})

type EditMode = 'auth' | 'mail' | 'file' | ''
const editMode = ref<EditMode>('')

const loading = ref(false)

const config = ref<Awaited<ReturnType<typeof Apis.adminConfig.get>>>()

const load = async () => {
  loading.value = true
  try {
    config.value = await Apis.adminConfig.get()
  } catch (e) {
    window.$message.error(t('loadFailed'))
    console.error(e)
  } finally {
    loading.value = false
  }
}

const switchEditMode = (mode: Exclude<EditMode, ''>) => {
  editMode.value = editMode.value === mode ? '' : mode
}

const renderActions = (mode: Exclude<EditMode, ''>, formRef: Ref<FormInst | undefined>) => {
  const editing = editMode.value === mode
  return (
    <div class="flex flex-row gap-2">
      <NpButton props={{ size: 'small' }} onClick={() => switchEditMode(mode)}>
        {editing ? t('cancel') : t('configure')}
      </NpButton>
      {editing ? (
        <NpButton props={{ size: 'small' }} type="primary" onClick={() => formRef.value?.submit()}>
          {t('save')}
        </NpButton>
      ) : undefined}
    </div>
  )
}
const { locale } = storeToRefs(useLocaleStore())
const renderForm = (
  mode: Exclude<EditMode, ''>,
  formRef: Ref<FormInst | undefined>,
  modelValue: any,
  option: ComputedRef<FormOption<any>>,
) => {
  if (editMode.value !== mode) {
    return undefined
  }
  return (
    <NpForm
      class="mt-2"
      key={locale.value}
      ref={formRef}
      modelValue={cloneDeep(modelValue)}
      option={option.value}
    ></NpForm>
  )
}

const buildAuth = (): NpCellGroupOption => {
  const formRef = ref<FormInst>()
  const { option } = useAuth(load)
  return {
    label: () => <span>{t('authTitle')}</span>,
    icon: () => <NIcon class="i-mdi-account-key-outline"></NIcon>,
    description: () => {
      const loginTypeNames: Record<string, string> = {
        password: t('password'),
        phone_code: t('phoneCode'),
        email_code: t('emailCode'),
      }
      const loginTypes =
        config.value?.auth.loginTypes
          .map((type) => loginTypeNames[type])
          .join(t('listSeparator')) || t('notSet')
      return (
        <span>
          {t('loginSummary', {
            registration: config.value?.auth.regEnabled
              ? t('registrationAllowed')
              : t('registrationBlocked'),
            types: loginTypes,
          })}
        </span>
      )
    },
    footer: () => renderForm('auth', formRef, config.value?.auth, option),
    value: () => renderActions('auth', formRef),
  }
}

const buildMail = (): NpCellGroupOption => {
  const formRef = ref<FormInst>()
  const { option } = useMail(load)
  const toForm = (): MailForm => {
    const server = config.value?.mail
    return server?.enabled
      ? {
          enabled: true,
          codeLen: server.codeLen,
          codeTtl: server.codeTtl,
          host: server.host,
          port: server.port,
          ssl: server.ssl,
          user: server.user,
          pass: server.pass,
          senderName: server.senderName,
        }
      : {
          enabled: false,
          codeLen: 6,
          codeTtl: 300,
          host: '',
          port: 587,
          ssl: true,
          user: '',
          pass: '',
          senderName: 'pika',
        }
  }
  return {
    label: () => <span>{t('mailTitle')}</span>,
    icon: () => <NIcon class="i-mdi-email-outline"></NIcon>,
    description: () => <span>{config.value?.mail.enabled ? t('enabled') : t('disabled')}</span>,
    footer: () => renderForm('mail', formRef, toForm(), option),
    value: () => renderActions('mail', formRef),
  }
}

const buildFile = (): NpCellGroupOption => {
  const formRef = ref<FormInst>()
  const { option } = useFile(load)
  const toForm = (): FileForm => {
    const server = config.value?.file
    if (server?.ossEnabled) {
      return {
        maxSize: server.maxSize,
        allowedTypes: server.allowedTypes.join(','),
        disabledTypes: server.disabledTypes.join(','),
        ossEnabled: true,
        ossEndpoint: server.ossEndpoint,
        ossBucket: server.ossBucket,
        ossAccessKeyId: server.ossAccessKeyId,
        ossSecretAccessKey: server.ossSecretAccessKey,
        ossRegion: server.ossRegion,
        ossForcePathStyle: server.ossForcePathStyle,
        ossDefaultUrlExpiresIn: server.ossDefaultUrlExpiresIn,
        ossHideFileUrl: server.ossHideFileUrl ?? false,
      }
    }
    return {
      maxSize: server?.maxSize ?? 20 * 1024 * 1024,
      allowedTypes: server?.allowedTypes.join(',') ?? '',
      disabledTypes: server?.disabledTypes.join(',') ?? '',
      ossEnabled: false,
      ossEndpoint: '',
      ossBucket: '',
      ossAccessKeyId: '',
      ossSecretAccessKey: '',
      ossRegion: '',
      ossForcePathStyle: false,
      ossDefaultUrlExpiresIn: 3600,
      ossHideFileUrl: false,
    }
  }
  return {
    label: () => <span>{t('fileTitle')}</span>,
    icon: () => <NIcon class="i-mdi-folder-outline"></NIcon>,
    description: () => {
      const form = toForm()
      const storageType = form.ossEnabled ? t('objectStorage') : t('localStorage')
      const maxMb = (form.maxSize / 1024 / 1024).toFixed(0)
      return <span>{t('fileSummary', { max: maxMb, type: storageType })}</span>
    },
    footer: () => renderForm('file', formRef, toForm(), option),
    value: () => renderActions('file', formRef),
  }
}

const options: NpCellGroupOption[] = [buildAuth(), buildMail(), buildFile()]

onMounted(load)
</script>

<style lang="scss" scoped>
.admin-config {
  :deep(.np-cell) {
    --np-cell-padding-y: 8px;
    .np-cell__icon {
      @apply pr-4;
      .n-icon {
        @apply w-6 h-6;
      }
    }
    .np-cell__wrapper {
      .np-cell__left {
        flex: 1;
      }
      .np-cell__right {
        padding-top: 2px;
      }
    }
    .np-cell__footer {
      padding-bottom: 0;
      .np-form {
        padding-top: 24px;
      }
    }
  }
  :deep(.np-form) {
    max-width: 480px;
  }
}
</style>

<i18n lang="yaml">
zh:
  loadFailed: 加载配置失败
  cancel: 取消
  configure: 配置
  save: 保存
  authTitle: 注册与登录
  password: 密码
  phoneCode: 手机验证码
  emailCode: 邮箱验证码
  listSeparator: 、
  notSet: 未设置
  registrationAllowed: 允许注册
  registrationBlocked: 禁止注册
  loginSummary: '{registration}，登录方式：{types}'
  mailTitle: 邮件
  fileTitle: 文件存储
  enabled: 已启用
  disabled: 未启用
  objectStorage: 对象存储
  localStorage: 本地存储
  fileSummary: 最大 {max} MB，{type}
en:
  loadFailed: Failed to load settings
  cancel: Cancel
  configure: Configure
  save: Save
  authTitle: Registration and login
  password: Password
  phoneCode: Phone code
  emailCode: Email code
  listSeparator: ', '
  notSet: Not set
  registrationAllowed: Registration enabled
  registrationBlocked: Registration disabled
  loginSummary: '{registration}; login methods: {types}'
  mailTitle: Email
  fileTitle: File storage
  enabled: Enabled
  disabled: Disabled
  objectStorage: Object storage
  localStorage: Local storage
  fileSummary: Maximum {max} MB, {type}
</i18n>
