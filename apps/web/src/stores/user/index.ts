import { defineStore } from 'pinia'
import type { User, TokenInfo } from './types'
import { useStorage } from '@/utils/storage'

/** 登录参数，与后端 token 接口的 `grant_type` 分支一致 */
type LoginParams =
  | { grant_type: 'password'; username: string; password: string }
  | { grant_type: 'phone_code'; phone: string; code: string }
  | { grant_type: 'email_code'; email: string; code: string }

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

  /**
   * 登录请求共用逻辑。
   * 需要第二因素时由 api 拦截器弹窗并重试，取消验证则请求直接失败，登录自然中止。
   */
  const login = async (data: LoginParams): Promise<void> => {
    tokenInfo.value = await Apis.auth.token({
      data,
      meta: { skipAuthRefresh: true },
    })
    try {
      // 用户信息是登录结果的一部分：拿不到就不能带着默认用户继续跳转，否则权限判断全错
      await userinfo(false)
    } catch (error) {
      // 回滚已签发的 token，避免「已登录但用户信息是默认值」的中间态
      tokenInfo.value = undefined
      throw error
    }
  }

  const loginPassword = (username: string, password: string) =>
    login({ grant_type: 'password', username, password })

  const loginPhoneCode = (phone: string, code: string) =>
    login({ grant_type: 'phone_code', phone, code })

  const loginEmailCode = (email: string, code: string) =>
    login({ grant_type: 'email_code', email, code })

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
