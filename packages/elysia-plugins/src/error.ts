import { Elysia, ElysiaError, NotFound, StatusMap, StatusMapBack, ValidationError } from 'elysia'
import type { TranslateMessageFn } from './i18n'

/**
 * 业务异常基类。
 *
 * - `message` 可为 i18n token（`i18n:{...}`），客户端可能直接展示给用户
 * - `detail` 不会被自动翻译，且不应包含敏感数据
 *
 * @example
 * ```ts
 * throw new HttpError(t('USER_NOT_FOUND'), 404)
 * throw new HttpError(t('FILE_UPLOAD_FAILED'), 400, err.message)
 * ```
 */
export class HttpError extends Error {
  override name: string
  status: number
  detail?: string

  constructor(message: string, status?: number, detail?: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status || 500
    this.detail = detail
  }
}

export type ErrorPluginOpts = {
  /** i18n 翻译函数，推荐传入 `createElysiaI18n` 返回实例上的 `translateMessage` */
  translateMessage: TranslateMessageFn
  /** Zod 校验失败时的兜底 code。@default 'VALIDATION_ERROR' */
  validationFallbackCode?: string
  /**
   * Zod 校验失败时的兜底文案。
   *
   * 接受 i18n token（如 `'i18n:COMMON.VALIDATION_ERROR'`），插件会在每次请求的 fallback
   * 路径上根据 `Accept-Language` 调用 `translateMessage` 重新翻译，以支持多语言。
   *
   * 翻译失败或 token 不在字典时回退到英文 `'Validation error'`。
   *
   * @default 'i18n:VALIDATION_ERROR'
   */
  validationFallbackMessage?: string
  /** 未知错误的 errorId 生成器。@default crypto.randomUUID */
  errorIdGenerator?: () => string
  /** 未知错误兜底日志回调，便于接入 server 自有日志（如 pino） */
  onUnknownError?: (error: Error, errorId: string) => void
}

export type ErrorResponseBody = { status: number; message: string; [x: string]: any }

/** 带状态码的错误对象：Elysia 内置 `ElysiaError` / `ElysiaStatus` / `HTTPError` 的共同形状 */
type StatusBearingError = { status?: number | keyof typeof StatusMap; response?: unknown }

/**
 * 读取错误自带的状态码。
 *
 * `HTTPError.status` 允许是 `StatusMap` 名称（如 `'Payment Required'`），这里统一归一化为数字。
 */
const readErrorStatus = (error: unknown): number | undefined => {
  if (typeof error !== 'object' || error === null) return
  const { status } = error as StatusBearingError
  if (typeof status === 'number') return status
  return status ? StatusMap[status] : undefined
}

/**
 * 全局错误处理插件。统一处理 `HttpError` / 校验失败 / `NotFound` / 内置状态码错误 / 未知错误。
 *
 * 应在 i18n plugin 之后注册，使 `errorPlugin` 能够调用 `translateMessage`。
 */
export const errorPlugin = (opts: ErrorPluginOpts) => {
  const generateErrorId = opts.errorIdGenerator ?? (() => globalThis.crypto.randomUUID())
  const fallbackCode = opts.validationFallbackCode ?? 'VALIDATION_ERROR'
  const fallbackMessageToken = opts.validationFallbackMessage ?? 'i18n:VALIDATION_ERROR'

  // 显式标注 `unknown`：错误响应的状态码是运行时决定的，
  // 若让 TS 推导成 `ElysiaStatus<number, ...>`，会污染所有路由的响应类型（Eden 的 data 会多出 `''` 等）
  return new Elysia()
    .onError(({ error, status, request }): unknown => {
      const resp = (statusCode: number, content: ErrorResponseBody) => {
        const accept = request.headers.get('accept')
        // 浏览器直接访问时返回纯文本，其余返回 JSON
        return status(statusCode, accept?.includes('text/html') ? content.message : content)
      }

      if (error instanceof HttpError) {
        const translated = opts.translateMessage(
          error.message,
          request.headers.get('accept-language'),
        )
        return resp(error.status, {
          status: error.status,
          code: translated?.key,
          message: translated?.message ?? error.message,
          detail: error.detail,
        })
      }

      if (error instanceof NotFound) {
        return resp(error.status, { status: error.status, message: error.response })
      }

      if (error instanceof ValidationError) {
        const acceptLanguage = request.headers.get('accept-language')
        const fallbackTranslated = opts.translateMessage(fallbackMessageToken, acceptLanguage)
        const fallbackMessage = fallbackTranslated?.message ?? 'Validation error'
        const all = error.all ?? []
        const sourceMessage = all[0]?.message
        const translated = sourceMessage
          ? opts.translateMessage(sourceMessage, acceptLanguage)
          : undefined
        const details = all.map(({ path, message }) => {
          const translatedDetail = opts.translateMessage(message, acceptLanguage)
          return {
            path,
            code: translatedDetail?.key ?? fallbackCode,
            message: translatedDetail?.message ?? message,
          }
        })
        return resp(error.status, {
          status: error.type === 'response' ? 500 : error.status,
          code: translated?.key ?? fallbackCode,
          message: translated?.message ?? fallbackMessage,
          details,
        })
      }

      // 用户主动 `throw new Response(...)` 时原样返回，不能被当成错误包装（Response 也有 `status` 字段）
      if (error instanceof Response) return error

      // Elysia 内置错误（`ParseError` / `InvalidCookie` / `HTTPError`）与 `throw status(...)` 都自带状态码，
      // 4xx 直接沿用，避免客户端错误被当作 500 服务端故障；5xx 仍走下面的未知错误分支，以便记录日志与 errorId
      const builtinStatus = readErrorStatus(error)
      if (builtinStatus !== undefined && builtinStatus < 500) {
        const { response } = error as StatusBearingError
        const statusText = StatusMapBack[builtinStatus as keyof typeof StatusMapBack]
        return resp(builtinStatus, {
          status: builtinStatus,
          message: typeof response === 'string' ? response : statusText,
        })
      }

      const errorId = generateErrorId()
      opts.onUnknownError?.(error instanceof Error ? error : new Error(String(error)), errorId)
      return resp(500, {
        status: 500,
        code: error instanceof ElysiaError && error.code ? error.code : 'UNKNOWN',
        message: 'Internal Server Error',
        errorId,
      })
    })
    .as('global')
}
