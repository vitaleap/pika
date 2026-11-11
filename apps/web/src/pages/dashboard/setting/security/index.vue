<template>
  <div class="setting-security">
    <n-card content-class="py-2!">
      <np-cell-group bordered :options="options"></np-cell-group>
    </n-card>
  </div>
</template>
<script setup lang="tsx">
import type { FormInst, FormOption, NpCellGroupOption } from 'naive-plus'
import { useEmail } from './email'
import { usePhone } from './phone'
import { usePassword } from './password'
import { useI18n } from 'vue-i18n'
import { i18nTitle } from '@/utils/i18n-title'

const { t } = useI18n()
definePage({
  meta: {
    title: i18nTitle('pageTitle.security'),
  },
})

const userStore = useUserStore()

type EditMode = 'email' | 'phone' | 'password'
const editMode = ref<'' | EditMode>('')

const currentEmail = computed(() => userStore.user.email ?? '')
const currentPhone = computed(() => userStore.user.phone_number ?? '')

const switchEditMode = (mode: EditMode) => {
  editMode.value = editMode.value === mode ? '' : mode
}

const buildCell = <T extends object>(config: {
  mode: EditMode
  label: string
  icon: string
  description: () => string
  createForm: (formRef: Ref<FormInst | undefined>) => ComputedRef<FormOption<T>>
}): NpCellGroupOption => {
  const formRef = ref<FormInst>()
  const formOption = config.createForm(formRef)

  return {
    label: () => <span>{config.label}</span>,
    icon: () => <NIcon class={config.icon}></NIcon>,
    description: () => <span>{config.description()}</span>,
    footer: () =>
      editMode.value === config.mode ? (
        <NpForm ref={formRef} class="mt-4" option={formOption.value}></NpForm>
      ) : undefined,
    value: () => {
      const editing = editMode.value === config.mode
      return (
        <div class="flex flex-row gap-2 pl-2">
          <NpButton props={{ size: 'small' }} onClick={() => switchEditMode(config.mode)}>
            {editing ? t('cancel') : t('edit')}
          </NpButton>
          {editing ? (
            <NpButton
              props={{ size: 'small' }}
              type="primary"
              onClick={() => formRef.value?.submit()}
            >
              {t('save')}
            </NpButton>
          ) : undefined}
        </div>
      )
    },
  }
}

const refreshUser = async () => {
  await userStore.userinfo()
  editMode.value = ''
}

const options: NpCellGroupOption[] = [
  buildCell({
    mode: 'email',
    label: t('email'),
    icon: 'i-mdi-email',
    description: () => {
      const email = userStore.user.email || t('notSet')
      const verified = userStore.user.email_verified ? t('verified') : t('unverified')
      return t('emailStatus', { email, verified })
    },
    createForm: (formRef) => useEmail(currentEmail, formRef, refreshUser).emailOption,
  }),
  buildCell({
    mode: 'phone',
    label: t('phone'),
    icon: 'i-mdi-cellphone',
    description: () => {
      const phone = userStore.user.phone_number || t('notSet')
      const verified = userStore.user.phone_number_verified ? t('verified') : t('unverified')
      return t('phoneStatus', { phone, verified })
    },
    createForm: (formRef) => usePhone(currentPhone, formRef, refreshUser).phoneOption,
  }),
  buildCell({
    mode: 'password',
    label: t('password'),
    icon: 'i-mdi-security',
    description: () => t('configured'),
    createForm: () => usePassword(() => (editMode.value = '')).passwordOption,
  }),
]
</script>
<style lang="scss">
.setting-security {
  .np-cell {
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
    }
  }
  .np-form {
    max-width: 440px;
  }
}
</style>

<i18n lang="yaml">
zh:
  email: 邮箱
  phone: 手机号
  password: 密码
  notSet: 未设置
  verified: 已验证
  unverified: 未验证
  emailStatus: '{email}，{verified}'
  phoneStatus: '{phone}，{verified}'
  configured: 已设置
  edit: 修改
  cancel: 取消
  save: 保存
en:
  email: Email
  phone: Phone
  password: Password
  notSet: Not set
  verified: Verified
  unverified: Unverified
  emailStatus: '{email}, {verified}'
  phoneStatus: '{phone}, {verified}'
  configured: Configured
  edit: Edit
  cancel: Cancel
  save: Save
</i18n>
