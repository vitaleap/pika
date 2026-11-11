<template>
  <div class="admin-user p-4 flex flex-col">
    <n-card>
      <np-table :key="locale" :option="tableOption"></np-table>
    </n-card>

    <n-modal
      v-model:show="resetVisible"
      preset="card"
      content-class="pb-0!"
      :title="t('resetTitle')"
      style="width: 420px"
    >
      <np-form v-model="resetForm" :option="resetOption" />
    </n-modal>
  </div>
</template>

<script setup lang="tsx">
import type { FormOption, TableOption } from 'naive-plus'
import { useI18n } from 'vue-i18n'
import { formatTime } from '@/utils/date'
import { i18nTitle } from '@/utils/i18n-title'

type UserItem = Awaited<ReturnType<typeof Apis.adminUser.list>>['items'][number]

type ResetForm = {
  id: string
  password: string
}

const { t } = useI18n()
const { locale } = storeToRefs(useLocaleStore())
definePage({
  meta: {
    title: i18nTitle('pageTitle.userManagement'),
  },
})

const resetVisible = ref(false)
const resetForm = ref<ResetForm>({
  id: '',
  password: '',
})

const renderContact = (value: string | undefined, verified: boolean) => {
  if (!value) {
    return <span class="color-text-3">{t('notBound')}</span>
  }
  return (
    <div class="flex flex-row items-center gap-2">
      <span>{value}</span>
      <NTag size="small" type={verified ? 'success' : 'warning'}>
        {verified ? t('verified') : t('unverified')}
      </NTag>
    </div>
  )
}

const openReset = (row: UserItem) => {
  resetForm.value = { id: row.id, password: '' }
  resetVisible.value = true
}

const resetOption = computed<FormOption<ResetForm>>(() => ({
  props: { labelPlacement: 'top' },
  footer: {
    align: 'right',
    submitBtn: { text: t('submit') },
    resetBtn: { text: t('reset') },
  },
  onSubmit: async (data) => {
    await Apis.adminUser.resetPassword({
      pathParams: { id: resetForm.value.id },
      data: { password: data.password },
      meta: { toast: false },
    })
    window.$message.success(t('resetSuccess'))
    resetVisible.value = false
  },
  columns: [
    {
      label: t('newPassword'),
      key: 'password',
      type: 'password',
      rule: { required: true, message: t('passwordRequired') },
      props: {
        placeholder: t('newPasswordPlaceholder'),
        showPasswordOn: 'click',
      },
    },
  ],
}))

const tableOption = computed<TableOption<UserItem>>(() => ({
  props: { scrollX: 980 },
  search: {
    placeholder: t('searchPlaceholder'),
    width: locale.value === 'zh' ? 240 : 280,
  },
  api: {
    fetch: async ({ page, pageSize }, queryParams) => {
      const { items, total } = await Apis.adminUser.list({
        params: {
          page,
          pageSize,
          keyword: queryParams.keyword,
          emailVerified: queryParams.emailVerified,
          phoneNumberVerified: queryParams.phoneNumberVerified,
        },
      })
      return { items, itemCount: total }
    },
    edit: async (row) => {
      await Apis.adminUser.update({
        pathParams: { id: row.id },
        data: {
          name: row.name,
          email: row.email || null,
          emailVerified: row.emailVerified,
          phoneNumber: row.phoneNumber || null,
          phoneNumberVerified: row.phoneNumberVerified,
        },
      })
      window.$message.success(t('saveSuccess'))
    },
    del: async (row) => {
      await Apis.adminUser.remove({ pathParams: { id: row.id } })
      window.$message.success(t('removeSuccess'))
    },
  },
  filters: [
    {
      key: 'emailVerified',
      label: t('emailVerified'),
      multiple: false,
      options: [
        { label: t('verified'), value: true },
        { label: t('unverified'), value: false },
      ],
    },
    {
      key: 'phoneNumberVerified',
      label: t('phoneNumberVerified'),
      multiple: false,
      options: [
        { label: t('verified'), value: true },
        { label: t('unverified'), value: false },
      ],
    },
  ],
  operation: {
    label: t('operation'),
    options: [
      { type: 'edit', label: t('edit') },
      { type: 'del', label: () => <NText type="error">{t('remove')}</NText> },
      { key: 'resetPassword', label: t('resetPassword') },
    ],
    onSelect: (key, row) => {
      if (key === 'resetPassword') {
        openReset(row)
      }
    },
  },
  // 列级 display 控制表格显隐，formProps.display 控制内置编辑表单显隐
  columns: [
    {
      key: 'name',
      label: t('name'),
      props: { minWidth: 160 },
      formProps: {
        type: 'input',
        rule: { required: true, message: t('nameRequired') },
      },
      render: (row) => (
        <div class="flex flex-row items-center gap-2">
          <WAvatar src={row.picture} text={row.name} size={32} round />
          <span>{row.name}</span>
        </div>
      ),
    },
    {
      key: 'email',
      label: t('email'),
      props: { minWidth: 240 },
      formProps: { type: 'input' },
      render: (row) => renderContact(row.email, row.emailVerified),
    },
    {
      key: 'emailVerified',
      label: t('emailVerified'),
      display: false,
      formProps: { type: 'switch' },
    },
    {
      key: 'phoneNumber',
      label: t('phoneNumber'),
      props: { minWidth: 200 },
      formProps: { type: 'input' },
      render: (row) => renderContact(row.phoneNumber, row.phoneNumberVerified),
    },
    {
      key: 'phoneNumberVerified',
      label: t('phoneNumberVerified'),
      display: false,
      formProps: { type: 'switch' },
    },
    {
      key: 'createAt',
      label: t('createAt'),
      props: { width: 160 },
      formProps: { display: false },
      render: (row) => <span>{formatTime(row.createAt, 'YYYY-MM-DD HH:mm')}</span>,
    },
    {
      key: 'loginAt',
      label: t('loginAt'),
      props: { width: 160 },
      formProps: { display: false },
      render: (row) => <span>{formatTime(row.loginAt, 'YYYY-MM-DD HH:mm') || '-'}</span>,
    },
  ],
}))
</script>

<i18n lang="yaml">
zh:
  searchPlaceholder: 搜索用户名、邮箱或手机号
  name: 用户名
  email: 邮箱
  emailVerified: 邮箱验证
  phoneNumber: 手机号
  phoneNumberVerified: 手机验证
  createAt: 注册时间
  loginAt: 最后登录
  operation: 操作
  verified: 已验证
  unverified: 未验证
  notBound: 未绑定
  edit: 编辑
  remove: 删除
  nameRequired: 用户名不能为空
  resetPassword: 重置密码
  resetTitle: 重置密码
  newPassword: 新密码
  newPasswordPlaceholder: 请输入新密码
  passwordRequired: 密码不能为空
  resetSuccess: 密码重置成功
  submit: 提交
  reset: 重置
  saveSuccess: 保存成功
  removeSuccess: 删除成功
en:
  searchPlaceholder: Search by name, email or phone
  name: Name
  email: Email
  emailVerified: Email verified
  phoneNumber: Phone
  phoneNumberVerified: Phone verified
  createAt: Registered at
  loginAt: Last login
  operation: Actions
  verified: Verified
  unverified: Unverified
  notBound: Not bound
  edit: Edit
  remove: Delete
  nameRequired: Name is required
  resetPassword: Reset password
  resetTitle: Reset password
  newPassword: New password
  newPasswordPlaceholder: Enter new password
  passwordRequired: Password is required
  resetSuccess: Password reset
  submit: Submit
  reset: Reset
  saveSuccess: Saved
  removeSuccess: Deleted
</i18n>
