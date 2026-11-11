import { createAlova, Method } from 'alova'
import fetchAdapter from 'alova/fetch'
import { createApis, withConfigType, mountApis } from './createApis'
import { pinia } from '@/stores'
import router from '@/router'
import { i18n } from '@/utils/i18n'
import { isString, throttle } from 'es-toolkit'

const userStore = useUserStore(pinia)
const preferenceStore = usePreferenceStore(pinia)

declare module 'alova' {
  interface AlovaCustomTypes {
    meta: {
      /**
       * 请求异常时，不显示错误信息
       */
      toast?: boolean
      /**
       * 跳过 token 自动刷新
       */
      skipAuthRefresh?: boolean
    }
  }
}

let refreshPromise: Promise<void> | undefined

const autoRefreshToken = async (method: Method) => {
  const accessToken = userStore.tokenInfo?.access_token
  if (accessToken && method.config.headers.Authorization !== `Bearer ${accessToken}`) {
    method.config.meta = { ...method.config.meta, toast: false, skipAuthRefresh: true }
    return await alovaInstance.Request(method)
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
    method.config.meta = { ...method.config.meta, toast: false, skipAuthRefresh: true }
    return await alovaInstance.Request(method)
  } catch {
    // 刷新失败后即将跳转登录页，抑制原请求的 toast，避免与刷新接口的错误重复弹出
    method.config.meta = { ...method.config.meta, toast: false }
    userStore.logout()
  }

  // 已在 /login：不要再 push，否则会让 redirect 变成 /login?... 形成循环
  if (window.location.pathname !== '/login') {
    router.push('/login')
  }
  return undefined
}
const showMessage = throttle((msg) => {
  window.$message?.error(msg)
}, 250)

export const alovaInstance = createAlova({
  baseURL: '/api',
  cacheFor: null,
  requestAdapter: fetchAdapter(),
  beforeRequest: (method) => {
    method.config.headers['Accept-Language'] = i18n.global.locale.value
    method.config.headers['Time-Zone'] = preferenceStore.resolvedTimeZone
    if (userStore.tokenInfo) {
      method.config.headers.Authorization = `Bearer ${userStore.tokenInfo.access_token}`
    }
  },
  responded: async (res, method) => {
    let data
    if (res.headers.get('content-type')?.includes('application/json')) {
      data = await res.json()
    } else {
      data = await res.text()
    }
    if (!res.ok) {
      let err = isString(data) ? data : data?.message
      if (res.status === 401 && method.config.meta?.skipAuthRefresh !== true) {
        const retryRes = await autoRefreshToken(method)
        if (retryRes) {
          return retryRes
        }
      }
      if (!err) {
        err =
          res.status === 502
            ? i18n.global.t('requestError.network')
            : res.status === 429
              ? i18n.global.t('requestError.tooManyRequests')
              : i18n.global.t('requestError.serverUnavailable')
      }
      if (method.config.meta?.toast !== false) {
        // $message 在 App.vue onMounted 才注入，启动阶段的请求失败时可能尚未就绪
        showMessage(err)
      }
      throw Error(err)
    }
    return data
  },
})

export const $$userConfigMap = withConfigType({})

const Apis = createApis(alovaInstance, $$userConfigMap)

mountApis(Apis)

export default Apis
