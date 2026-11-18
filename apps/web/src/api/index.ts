import { createAlova } from 'alova'
import fetchAdapter from 'alova/fetch'
import { isPlainObject, throttle } from 'es-toolkit'
import { createApis, withConfigType, mountApis } from './createApis'
import { MULTI_FACTOR_REQUIRED, retryWithMultiFactor } from './middleware/multi-factor'
import { autoRefreshToken } from './middleware/token-refresh'
import type { MultiFactorType } from '@/composables/multi-factor-verify'
import { pinia } from '@/stores'
import { i18n } from '@/utils/i18n'

/** 自动弹窗处理多因素验证时的可选项 */
type MultiFactorOptions = {
  /**
   * 允许展示的验证类型，仅决定「显不显示」，不控制顺序。
   * 不传时使用后端返回的已绑定类型。
   */
  types?: MultiFactorType[]
}

declare module 'alova' {
  interface AlovaCustomTypes {
    meta: {
      /** 请求异常时，不显示错误信息 */
      toast?: boolean
      /** 跳过 token 自动刷新 */
      skipAuthRefresh?: boolean
      /** 需要多因素验证时是否自动弹窗并重试，默认开启 */
      multiFactor?: boolean | MultiFactorOptions
    }
  }
}

/** 按 content-type 解析响应体，无内容响应（如 204）返回 `undefined` */
const parseBody = async (res: Response): Promise<unknown> => {
  if (res.status === 204) {
    return undefined
  }
  const text = await res.text()
  if (!text || !res.headers.get('content-type')?.includes('application/json')) {
    return text || undefined
  }
  return JSON.parse(text)
}

/** 读取后端错误体（`{ code, message }`），缺失信息时按状态码兜底 */
const readError = (data: unknown, status: number): { code?: string; message: string } => {
  const body = isPlainObject(data) ? (data as { code?: string; message?: string }) : undefined
  if (body?.message) {
    return { code: body.code, message: body.message }
  }
  const fallback: Record<number, string> = {
    502: i18n.global.t('requestError.network'),
    429: i18n.global.t('requestError.tooManyRequests'),
  }
  return {
    code: body?.code,
    message: fallback[status] ?? i18n.global.t('requestError.serverUnavailable'),
  }
}

/** 并发请求同时失败时只提示一条，避免弹出一连串相同提示 */
const showError = throttle((message: string) => {
  window.$message?.error(message)
}, 250)

const userStore = useUserStore(pinia)
const preferenceStore = usePreferenceStore(pinia)

export const alovaInstance = createAlova({
  baseURL: '/api',
  cacheFor: null,
  shareRequest: false,
  requestAdapter: fetchAdapter(),
  beforeRequest: (method) => {
    method.config.headers['Accept-Language'] = i18n.global.locale.value
    method.config.headers['Time-Zone'] = preferenceStore.resolvedTimeZone
    if (userStore.tokenInfo) {
      method.config.headers.Authorization = `Bearer ${userStore.tokenInfo.access_token}`
    }
  },
  responded: async (res, method) => {
    const data = await parseBody(res)
    if (res.ok) {
      return data
    }
    // access_token 失效：自动刷新后重试，失败时会退出登录并跳转登录页
    if (res.status === 401 && method.config.meta?.skipAuthRefresh !== true) {
      const refreshed = await autoRefreshToken(method)
      if (refreshed.handled) {
        return refreshed.data
      }
    }
    const { code, message } = readError(data, res.status)
    // 需要第二因素时先弹窗重试，避免「请完成多因素验证」与校验弹窗重复提示
    if (code === MULTI_FACTOR_REQUIRED && method.config.meta?.multiFactor !== false) {
      const retried = await retryWithMultiFactor(method, data)
      if (retried.handled) {
        return retried.data
      }
    }
    if (method.config.meta?.toast !== false) {
      // $message 在 App.vue onMounted 才注入，启动阶段的请求失败时可能尚未就绪
      showError(message)
    }
    // 带上后端返回的错误码，便于调用方区分特殊错误（如用户取消安全验证）
    throw Object.assign(new Error(message), { code })
  },
})

export const $$userConfigMap = withConfigType({})

const Apis = createApis(alovaInstance, $$userConfigMap)

mountApis(Apis)

export default Apis
