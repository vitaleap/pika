import { useUserStore } from '@/stores/user'
import { setStore, getStore } from '@/utils/storage'
import type { FormOption } from 'naive-plus'
import { NIcon } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { LocaleMessages } from '@/utils/i18n'

const messages: LocaleMessages = {
  zh: {
    login: '登录',
    accountPlaceholder: '输入用户名/手机号/邮箱',
    passwordPlaceholder: '输入密码',
    required: '不能为空',
  },
  en: {
    login: 'Log in',
    accountPlaceholder: 'Username, phone, or email',
    passwordPlaceholder: 'Password',
    required: 'Required',
  },
}

const LOGIN_USERNAME_KEY = 'login_username'

export const useOption = (onOk: () => void) => {
  const userStore = useUserStore()
  const { t } = useI18n({ useScope: 'isolated', messages })

  type Form = {
    username: string
    password: string
  }

  const option = computed<FormOption<Form>>(() => ({
    props: {
      showLabel: false,
    },
    footer: {
      submitBtn: {
        text: t('login'),
        props: {
          block: true,
          // 用原生 submit 触发表单提交，浏览器与密码管理器才能感知登录动作
          attrType: 'submit',
        },
      },
      resetBtn: false,
    },
    enterSubmitMode: 'last',
    onSubmit: async ({ username, password }) => {
      await userStore.loginPassword(username, password)
      setStore(LOGIN_USERNAME_KEY, username)
      onOk()
    },
    columns: [
      {
        key: 'username',
        props: {
          placeholder: t('accountPlaceholder'),
          maxlength: 40,
          clearable: true,
          // 标记为账号字段，供 Bitwarden 等识别并填充
          inputProps: {
            name: 'username',
            autocomplete: 'username',
          },
        },
        rule: { required: true, trigger: 'input', message: t('required') },
        slots: {
          prefix: () => [<NIcon class="i-mdi-user"></NIcon>],
        },
        defaultValue: getStore<string>(LOGIN_USERNAME_KEY) || '',
      },
      {
        key: 'password',
        type: 'password',
        props: {
          placeholder: t('passwordPlaceholder'),
          maxlength: 50,
          clearable: true,
          showPasswordOn: 'click',
          // 标记为当前密码字段，供 Bitwarden 等识别并提示保存
          inputProps: {
            name: 'password',
            autocomplete: 'current-password',
          },
        },
        rule: { required: true, trigger: 'input', message: t('required') },
        slots: {
          prefix: () => [<NIcon class="i-mdi-password"></NIcon>],
        },
      },
    ],
  }))
  return { option }
}
