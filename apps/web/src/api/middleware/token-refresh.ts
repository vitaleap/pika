import type { Method } from 'alova'
import router from '@/router'
import { pinia } from '@/stores'

const userStore = useUserStore(pinia)

/** 重试结果，`handled: false` 表示无法恢复（已退出登录并跳转登录页） */
export type TokenRefreshResult = { handled: true; data: unknown } | { handled: false }

let refreshPromise: Promise<void> | undefined

/**
 * 401 时自动刷新 token 后重试原请求。
 */
export const autoRefreshToken = async (method: Method): Promise<TokenRefreshResult> => {
  const accessToken = userStore.tokenInfo?.access_token
  // token 已被其他请求刷新：直接用新 token 重试，避免重复刷新
  if (accessToken && method.config.headers.Authorization !== `Bearer ${accessToken}`) {
    method.config.meta = { ...method.config.meta, skipAuthRefresh: true }
    return { handled: true, data: await method.send() }
  }

  try {
    if (!refreshPromise) {
      const refreshToken = userStore.tokenInfo?.refresh_token
      if (!refreshToken) {
        throw new Error('缺少刷新令牌')
      }
      refreshPromise = userStore.refreshToken(refreshToken).finally(() => {
        refreshPromise = undefined
      })
    }
    await refreshPromise
  } catch {
    // 刷新失败后即将跳转登录页，抑制原请求的 toast，避免与刷新接口的错误重复弹出
    method.config.meta = { ...method.config.meta, toast: false }
    userStore.logout()
    // 已在 /login：不要再 push，否则会让 redirect 变成 /login?... 形成循环
    if (window.location.pathname !== '/login') {
      router.push('/login')
    }
    return { handled: false }
  }

  // 刷新成功后再重试原请求，重试失败按普通错误处理（保留 toast），不能当成刷新失败退出登录
  method.config.meta = { ...method.config.meta, skipAuthRefresh: true }
  return { handled: true, data: await method.send() }
}
