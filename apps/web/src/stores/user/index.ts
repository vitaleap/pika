import { defineStore } from 'pinia'
import type { User, TokenInfo } from './types'
import { useStorage } from '@/utils/storage'

const defaultUser: User = {
  id: '10000',
  nickname: 'Momo',
}

export const useUserStore = defineStore('user', () => {
  const user = useStorage<User>(`user`, defaultUser)
  const tokenInfo = useStorage<TokenInfo | undefined>(`tokenInfo`, undefined)
  const isLogin = computed(() => tokenInfo.value?.access_token !== undefined)

  const logout = () => {
    user.value = defaultUser
    tokenInfo.value = undefined
    // 外观风格属于账号数据，退出后清空本地缓存，避免下一个账号复用
    usePreferenceStore().reset()
  }

  const userinfo = async (toast = true) => {
    const res = await Apis.auth.userinfo({ meta: { toast } })
    user.value = {
      ...res,
      id: res.sub,
    }
    // 登录后同步服务端保存的外观风格（明亮 / 暗黑两套）
    void usePreferenceStore().load()
  }

  const refreshToken = async (refreshToken: string) => {
    // 自动刷新流程内部使用，失败时由调用方统一提示并跳转登录页，此处不再单独弹 toast
    tokenInfo.value = await Apis.auth.token({
      data: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      },
      meta: { toast: false, skipAuthRefresh: true },
    })
  }

  const loginPassword = async (username: string, password: string) => {
    tokenInfo.value = await Apis.auth.token({
      data: {
        grant_type: 'password',
        username,
        password,
      },
    })
    await userinfo()
  }

  const loginPhoneCode = async (phone: string, code: string) => {
    tokenInfo.value = await Apis.auth.token({
      data: {
        grant_type: 'phone_code',
        phone,
        code,
      },
    })
    await userinfo()
  }

  const loginEmailCode = async (email: string, code: string) => {
    tokenInfo.value = await Apis.auth.token({
      data: {
        grant_type: 'email_code',
        email,
        code,
      },
    })
    await userinfo()
  }

  const sendCode = async (
    channel: 'email' | 'phone',
    target: string,
    uniqueId = '',
  ): Promise<void> => {
    const payload =
      channel === 'email'
        ? { channel: 'email' as const, email: target, uniqueId }
        : { channel: 'phone' as const, phone: target, uniqueId }
    await Apis.auth.sendCode({ data: payload })
  }

  return {
    user,
    tokenInfo,
    isLogin,
    logout,
    userinfo,
    refreshToken,
    loginPassword,
    loginPhoneCode,
    loginEmailCode,
    sendCode,
  }
})
