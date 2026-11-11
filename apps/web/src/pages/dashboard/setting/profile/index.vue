<template>
  <n-card content-class="pb-0!">
    <np-form :option="option"></np-form>
  </n-card>
</template>
<script setup lang="tsx">
import type { FormOption } from 'naive-plus'
import Avatar from './components/avatar.vue'
import { useI18n } from 'vue-i18n'
import { i18nTitle } from '@/utils/i18n-title'

const { t } = useI18n()

definePage({
  meta: {
    title: i18nTitle('pageTitle.profile'),
  },
})
const userStore = useUserStore()
const option = computed<
  FormOption<{
    name: string
  }>
>(() => ({
  async onSubmit(form) {
    const res = await Apis.user.edit({ data: { name: form.name } })
    // 同步本地用户信息，否则左下角等使用 userStore 的地方不会更新
    userStore.user.name = res.name
    window.$message.success(t('saved'))
  },
  columns: [
    {
      key: 'avatar',
      render: () => {
        return <Avatar></Avatar>
      },
    },
    {
      label: t('nickname'),
      key: 'name',
      defaultValue: userStore.user.name,
      formItemProps: { showRequireMark: false },
      rule: [{ required: true, message: t('required') }],
    },
  ],
  footer: { style: { justifyContent: 'end' } },
}))
</script>

<i18n lang="yaml">
zh:
  saved: 已保存
  nickname: 昵称
  required: 不能为空
en:
  saved: Saved
  nickname: Display name
  required: Required
</i18n>
