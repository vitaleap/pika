<template>
  <div class="admin-login-log p-4 flex flex-col">
    <n-card>
      <np-table :key="locale" :option="tableOption"></np-table>
    </n-card>
  </div>
</template>

<script setup lang="tsx">
import type { TableColumn, TableOption } from 'naive-plus'
import { NIcon, NTooltip } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { i18nTitle } from '@/utils/i18n-title'
import { formatTime } from '@/utils/date'
import { formatTimeAgo } from '@vueuse/core'
import dayjs from 'dayjs'

type LoginLogItem = Awaited<ReturnType<typeof Apis.adminLoginLog.list>>['items'][number]

const { t } = useI18n()
const { locale } = storeToRefs(useLocaleStore())

definePage({
  meta: {
    title: i18nTitle('pageTitle.loginLog'),
  },
})

const deviceKeys = {
  web: 'deviceWeb',
  h5: 'deviceH5',
  app: 'deviceApp',
  desktop: 'deviceDesktop',
} as const

const loginTypeKeys = {
  password: 'loginTypePassword',
  email_code: 'loginTypeEmailCode',
  phone_code: 'loginTypePhoneCode',
  refresh_token: 'loginTypeRefreshToken',
} as const

// render 回调的 row 是 any，这里显式收窄索引类型
const deviceLabel = (type: LoginLogItem['deviceType']) => t(deviceKeys[type])

const loginTypeLabel = (type: LoginLogItem['loginType']) => t(loginTypeKeys[type])

const tableOption = computed<TableOption<LoginLogItem>>(() => {
  const columns: TableColumn<LoginLogItem>[] = [
    {
      key: 'createAt',
      label: t('createAt'),
      props: { width: 120 },
      render: (row) => (
        <div>
          <div>{formatTime(row.createAt, 'HH:mm:ss')}</div>
          <div class="color-text-2 text-size-xs">{formatTime(row.createAt, 'YYYY-MM-DD')}</div>
        </div>
      ),
    },
    {
      key: 'username',
      label: t('username'),
      props: { minWidth: 200, maxWidth: 300 },
    },
    {
      key: 'ip',
      label: t('ip'),
      props: { width: 150 },
    },
    {
      key: 'deviceType',
      label: t('deviceType'),
      props: { width: 130 },
      render: (row) => (
        <div class="flex items-center gap-1">
          <NTag size="small">{deviceLabel(row.deviceType)}</NTag>
          {row.userAgent && (
            <NTooltip style={{ maxWidth: '320px' }}>
              {{
                trigger: () => (
                  <NIcon class="i-mdi-information-outline color-text-2 cursor-help" size={15} />
                ),
                default: () => <div class="break-all">{row.userAgent}</div>,
              }}
            </NTooltip>
          )}
        </div>
      ),
    },
    {
      key: 'loginType',
      label: t('loginType'),
      props: { width: 120 },
      render: (row) => <span>{loginTypeLabel(row.loginType)}</span>,
    },
    {
      key: 'success',
      label: t('result'),
      props: { width: 100 },
      render: (row) => (
        <NTag size="small" type={row.success ? 'success' : 'error'}>
          {row.success ? t('success') : t('failed')}
        </NTag>
      ),
    },
    {
      key: 'failReason',
      label: t('failReason'),
      props: { width: 160, ellipsis: { tooltip: true } },
      render: (row) => <span>{row.failReason || '-'}</span>,
    },
  ]

  // naive-ui 仅在显式设置 scrollX 时才渲染横向滚动条；取列宽合计作为内容最小宽度，避免列被压缩
  const scrollX = columns.reduce(
    (total, col) => total + (Number(col.props?.width ?? col.props?.minWidth) || 0),
    0,
  )

  return {
    props: { scrollX },
    search: {
      placeholder: t('searchPlaceholder'),
      width: locale.value === 'zh' ? 220 : 260,
    },
    api: {
      fetch: async ({ page, pageSize }, queryParams) => {
        const { items, total } = await Apis.adminLoginLog.list({
          params: {
            page,
            pageSize,
            keyword: queryParams.keyword,
            success: queryParams.success,
            loginType: queryParams.loginType,
          },
        })
        return { items, itemCount: total }
      },
    },
    operation: false,
    filters: [
      {
        key: 'success',
        label: t('result'),
        multiple: false,
        options: [
          { label: t('success'), value: true },
          { label: t('failed'), value: false },
        ],
      },
      {
        key: 'loginType',
        label: t('loginType'),
        multiple: false,
        options: [
          { label: t('loginTypePassword'), value: 'password' },
          { label: t('loginTypeEmailCode'), value: 'email_code' },
          { label: t('loginTypePhoneCode'), value: 'phone_code' },
          { label: t('loginTypeRefreshToken'), value: 'refresh_token' },
        ],
      },
    ],
    columns,
  }
})
</script>

<i18n lang="yaml">
zh:
  searchPlaceholder: 搜索用户名或 IP
  createAt: 登录时间
  username: 用户名
  ip: IP 地址
  deviceType: 设备
  deviceWeb: 浏览器
  deviceH5: H5
  deviceApp: App
  deviceDesktop: 桌面端
  loginType: 登录方式
  loginTypePassword: 密码
  loginTypeEmailCode: 邮箱验证码
  loginTypePhoneCode: 手机验证码
  loginTypeRefreshToken: 刷新令牌
  result: 结果
  success: 成功
  failed: 失败
  failReason: 失败原因
en:
  searchPlaceholder: Search by username or IP
  createAt: Login at
  username: Username
  ip: IP address
  deviceType: Device
  deviceWeb: Browser
  deviceH5: H5
  deviceApp: App
  deviceDesktop: Desktop
  loginType: Login method
  loginTypePassword: Password
  loginTypeEmailCode: Email code
  loginTypePhoneCode: Phone code
  loginTypeRefreshToken: Refresh token
  result: Result
  success: Success
  failed: Failed
  failReason: Fail reason
</i18n>
