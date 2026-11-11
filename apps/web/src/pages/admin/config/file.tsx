import type { FormOption } from 'naive-plus'
import type { FileForm } from './composables'
import { useI18n } from 'vue-i18n'
import type { LocaleMessages } from '@/utils/i18n'

const messages: LocaleMessages = {
  zh: {
    saveSuccess: '保存成功',
    maxSize: '最大尺寸',
    bytes: '字节',
    enterMaxSize: '请输入最大尺寸',
    allowedTypes: '允许文件类型',
    disabledTypes: '禁止文件类型',
    typesPlaceholder: '多个类型用逗号分隔',
    enableOss: '启用对象存储',
    enterEndpoint: '请输入 Endpoint',
    invalidEndpoint: 'Endpoint 格式错误',
    enterBucket: '请输入 Bucket',
    enterAccessKeyId: '请输入 AccessKeyId',
    enterSecretAccessKey: '请输入 SecretAccessKey',
    enterRegion: '请输入 Region',
    urlExpiry: 'URL 过期（秒）',
    enterUrlExpiry: '请输入 URL 过期时间',
    hideFileUrl: '隐藏文件 URL',
  },
  en: {
    saveSuccess: 'Saved',
    maxSize: 'Maximum size',
    bytes: 'bytes',
    enterMaxSize: 'Enter a maximum size',
    allowedTypes: 'Allowed file types',
    disabledTypes: 'Blocked file types',
    typesPlaceholder: 'Separate multiple types with commas',
    enableOss: 'Enable object storage',
    enterEndpoint: 'Enter an endpoint',
    invalidEndpoint: 'Invalid endpoint URL',
    enterBucket: 'Enter a bucket',
    enterAccessKeyId: 'Enter an AccessKeyId',
    enterSecretAccessKey: 'Enter a SecretAccessKey',
    enterRegion: 'Enter a region',
    urlExpiry: 'URL expiry (seconds)',
    enterUrlExpiry: 'Enter a URL expiry time',
    hideFileUrl: 'Hide file URL',
  },
}

const splitTypes = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)

const pickOssFields = (data: FileForm) => ({
  ossEndpoint: data.ossEndpoint,
  ossBucket: data.ossBucket,
  ossAccessKeyId: data.ossAccessKeyId,
  ossSecretAccessKey: data.ossSecretAccessKey,
  ossRegion: data.ossRegion,
  ossForcePathStyle: data.ossForcePathStyle,
  ossDefaultUrlExpiresIn: data.ossDefaultUrlExpiresIn,
  ossHideFileUrl: data.ossHideFileUrl,
})

export const useFile = (onSaved: () => Promise<void> | void) => {
  const { t } = useI18n({ useScope: 'isolated', messages })
  const option = computed<FormOption<FileForm>>(() => ({
    props: { labelPlacement: systemInfo.value.md ? 'left' : 'top', labelWidth: '140px' },
    footer: false,
    onSubmit: async (data) => {
      const base = {
        maxSize: data.maxSize,
        allowedTypes: splitTypes(data.allowedTypes),
        disabledTypes: splitTypes(data.disabledTypes),
      }
      const payload = data.ossEnabled
        ? { ...base, ossEnabled: true as const, ...pickOssFields(data) }
        : { ...base, ossEnabled: false as const }
      await Apis.adminConfig.update({ data: { file: payload } })
      window.$message.success(t('saveSuccess'))
      await onSaved()
    },
    columns: [
      {
        label: t('maxSize'),
        key: 'maxSize',
        type: 'number',
        props: { min: 1024, step: 1024 * 1024 },
        slots: {
          suffix: () => [<span>{t('bytes')}</span>],
        },
        rule: [
          {
            type: 'number',
            required: true,
            trigger: ['change'],
            message: t('enterMaxSize'),
          },
        ],
      },
      {
        label: t('allowedTypes'),
        key: 'allowedTypes',
        props: { placeholder: 'image/jpeg,application/pdf' },
      },
      {
        label: t('disabledTypes'),
        key: 'disabledTypes',
        props: { placeholder: t('typesPlaceholder') },
      },
      { label: t('enableOss'), key: 'ossEnabled', type: 'switch' },
      {
        label: 'Endpoint',
        key: 'ossEndpoint',
        props: { placeholder: 'https://oss-cn-hangzhou.aliyuncs.com' },
        display: (data) => data.ossEnabled === true,
        rule: [
          { required: true, trigger: ['blur'], message: t('enterEndpoint') },
          { type: 'url', trigger: ['blur'], message: t('invalidEndpoint') },
        ],
      },
      {
        label: 'Bucket',
        key: 'ossBucket',
        display: (data) => data.ossEnabled === true,
        rule: [{ required: true, trigger: ['blur'], message: t('enterBucket') }],
      },
      {
        label: 'AccessKeyId',
        key: 'ossAccessKeyId',
        display: (data) => data.ossEnabled === true,
        rule: [{ required: true, trigger: ['blur'], message: t('enterAccessKeyId') }],
      },
      {
        label: 'SecretAccessKey',
        key: 'ossSecretAccessKey',
        type: 'password',
        display: (data) => data.ossEnabled === true,
        props: {
          showPasswordOn: 'click',
        },
        rule: [
          {
            required: true,
            trigger: ['blur'],
            message: t('enterSecretAccessKey'),
          },
        ],
      },
      {
        label: 'Region',
        key: 'ossRegion',
        props: { placeholder: 'oss-cn-hangzhou' },
        display: (data) => data.ossEnabled === true,
        rule: [{ required: true, trigger: ['blur'], message: t('enterRegion') }],
      },
      {
        label: 'Path Style',
        key: 'ossForcePathStyle',
        type: 'switch',
        display: (data) => data.ossEnabled === true,
      },
      {
        label: t('hideFileUrl'),
        key: 'ossHideFileUrl',
        type: 'switch',
        display: (data) => data.ossEnabled === true,
      },
      {
        label: t('urlExpiry'),
        key: 'ossDefaultUrlExpiresIn',
        type: 'number',
        props: { min: 60, max: 86400 },
        display: (data) => data.ossEnabled === true && data.ossHideFileUrl !== true,
        rule: [
          {
            type: 'number',
            required: true,
            trigger: ['change'],
            message: t('enterUrlExpiry'),
          },
        ],
      },
    ],
  }))
  return { option }
}
