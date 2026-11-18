import type { Method } from 'alova'
import { verifyMultiFactor, type MultiFactorType } from '@/composables/multi-factor-verify'
import { isPlainObject } from 'es-toolkit'

/** 后端要求第二因素时返回的错误码 */
export const MULTI_FACTOR_REQUIRED = 'SYSTEM.MULTI_FACTOR_REQUIRED'

/** 重试结果，`handled: false` 表示未重试（未注册弹窗、已有弹窗或用户取消） */
export type MultiFactorRetryResult = { handled: true; data: unknown } | { handled: false }

/** 是否已有安全验证弹窗进行中 */
let verifying = false

/** 是否为合法的验证方式，用于过滤后端返回值 */
const isMultiFactorType = (value: unknown): value is MultiFactorType =>
  value === 'totp' || value === 'recovery_code'

/** 从错误响应体中读取用户已绑定的验证方式（`data.mfaTypes`），弹窗据此只展示可用方式 */
const readMfaTypes = (body: unknown): MultiFactorType[] | undefined => {
  if (!isPlainObject(body) || !isPlainObject(body.data)) {
    return
  }
  const { mfaTypes } = body.data
  if (!Array.isArray(mfaTypes)) {
    return
  }
  const valid = mfaTypes.filter(isMultiFactorType)
  return valid.length > 0 ? valid : undefined
}

/**
 * 拦截「需要多因素验证」的响应，弹出安全验证后带上校验结果重试原请求。
 *
 * @param errorBody 后端错误响应体，`data.mfaTypes` 为已绑定的验证方式
 */
export const retryWithMultiFactor = async (
  method: Method,
  errorBody?: unknown,
): Promise<MultiFactorRetryResult> => {
  // 并发请求同时需要验证时只处理第一个，避免叠加多个弹窗
  if (verifying) {
    return { handled: false }
  }
  verifying = true
  try {
    const { multiFactor } = method.config.meta ?? {}
    const configuredTypes = typeof multiFactor === 'object' ? multiFactor.types : undefined
    const result = await verifyMultiFactor({
      // 显式配置优先，否则使用后端返回的已绑定方式，避免展示用户未绑定的方式
      types: configuredTypes?.length ? configuredTypes : readMfaTypes(errorBody),
      // 重试请求的错误展示在弹窗表单中，不再触发全局 toast 与二次弹窗
      submit: async (payload) => {
        // 校验结果写入请求体，与后端所有需要第二因素的接口字段保持一致
        const data = isPlainObject(method.data) ? method.data : {}
        const next = { ...data, mfaType: payload.type, mfaValue: payload.value }
        method.data = next
        // 重发时实例与 config 都会被读取，需同步
        method.config.data = next
        method.config.meta = { ...method.config.meta, toast: false, multiFactor: false }
        return await method.send()
      },
    })
    // 用户取消：不重试，按普通错误处理让调用方流程中止
    if (!result.ok) {
      return { handled: false }
    }
    return { handled: true, data: result.data }
  } finally {
    verifying = false
  }
}
