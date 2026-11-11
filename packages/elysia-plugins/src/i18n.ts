import { Elysia } from 'elysia'
import { mergeVaryHeader } from './utils/vary'

export const I18N_MESSAGE_PREFIX = 'i18n:'

export type I18nDictionary = Readonly<Record<string, string>>
export type I18nParamValue = string | number
export type I18nParams = Readonly<Record<string, I18nParamValue>>

export type I18nLocaleMessages<TMessages extends I18nDictionary> = {
  readonly [TKey in keyof TMessages]: string
}

/**
 * 单个模块的语言包：locale -> dict。
 * 例如 `{ zh: { ... }, en: { ... } }`。
 */
export type I18nModule = Readonly<Record<string, I18nDictionary>>

/**
 * 多模块字典结构：模块名 -> 模块字典。
 *
 *   {
 *     COMMON: { zh: { ... }, en: { ... } },
 *     SYSTEM: { zh: { ... }, en: { ... } },
 *   }
 */
export type I18nMessagesByModule<TModule extends I18nModule> = Readonly<Record<string, TModule>>

export type I18nToken = `${typeof I18N_MESSAGE_PREFIX}${string}`

/**
 * 将 i18n token（`i18n:{...}`）翻译为指定 Accept-Language 后得到的结构。
 * - key: 文案 key，便于客户端 i18n 匹配与日志检索
 * - locale: 命中的语言
 * - message: 翻译后的展示文案
 */
export type TranslateMessageResult = {
  key: string
  locale: string
  message: string
}

/**
 * 翻译函数签名。普通文本（非 i18n token）应返回 undefined，由调用方决定兜底文案。
 */
export type TranslateMessageFn = (
  message: string,
  acceptLanguage?: string | null,
) => TranslateMessageResult | undefined

export interface CreateElysiaI18nOptions<
  TModules extends I18nMessagesByModule<I18nModule>,
  TDefaultLocale extends keyof TModules[keyof TModules] & string,
> {
  defaultLocale: TDefaultLocale
  messages: TModules
}

type ExtractI18nParamNames<TMessage extends string> =
  TMessage extends `${string}{${infer TParam}}${infer TRest}`
    ? TParam | ExtractI18nParamNames<TRest>
    : never

type I18nParamArgs<TMessage extends string> = [ExtractI18nParamNames<TMessage>] extends [never]
  ? [params?: never]
  : [params: Readonly<Record<ExtractI18nParamNames<TMessage>, I18nParamValue>>]

const normalizeLocale = (locale: string) => locale.trim().toLowerCase().replaceAll('_', '-')

type LanguagePreference = {
  locale: string
  quality: number
  index: number
  specificity: number
}

const parseAcceptLanguage = (header: string): LanguagePreference[] => {
  const languages: LanguagePreference[] = []

  for (const [index, item] of header.split(',').entries()) {
    const [localePart, ...parameters] = item.split(';')
    const locale = localePart?.trim()
    if (!locale) {
      continue
    }

    let quality = 1
    const qualityParameter = parameters
      .find((parameter) => parameter.trim().toLowerCase().startsWith('q='))
      ?.trim()
    if (qualityParameter) {
      quality = Number(qualityParameter.slice(2))
      if (!Number.isFinite(quality) || quality < 0 || quality > 1) {
        continue
      }
    }
    const normalizedLocale = normalizeLocale(locale)
    languages.push({
      locale: normalizedLocale,
      quality,
      index,
      specificity: normalizedLocale === '*' ? 0 : normalizedLocale.split('-').length,
    })
  }

  return languages.sort((a, b) => b.quality - a.quality || a.index - b.index)
}

const interpolate = (message: string, params?: I18nParams): string => {
  if (!params) {
    return message
  }

  return message.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (placeholder, param: string) =>
    Object.hasOwn(params, param) ? String(params[param]) : placeholder,
  )
}

const isI18nParams = (value: unknown): value is I18nParams =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every(
    (param) => typeof param === 'string' || (typeof param === 'number' && Number.isFinite(param)),
  )

const assertI18nParams = (params?: I18nParams): void => {
  if (params !== undefined && !isI18nParams(params)) {
    throw new TypeError('i18n params must contain only strings or finite numbers')
  }
}

const splitNamespacedKey = (key: string): { module: string; subKey: string } | undefined => {
  const dotIndex = key.indexOf('.')
  if (dotIndex <= 0 || dotIndex === key.length - 1) {
    return undefined
  }
  return { module: key.slice(0, dotIndex), subKey: key.slice(dotIndex + 1) }
}

export const createElysiaI18n = <
  const TModules extends I18nMessagesByModule<I18nModule>,
  const TDefaultLocale extends keyof TModules[keyof TModules] & string,
>(
  options: CreateElysiaI18nOptions<TModules, TDefaultLocale>,
) => {
  type Locale = keyof TModules[keyof TModules] & string
  type ModuleName = keyof TModules & string

  // 所有 key 的字面量联合：`MODULE.SUBKEY`。
  // 例如 `COMMON.FORBIDDEN` | `SYSTEM.USER_NOT_FOUND` | ...
  type Key = {
    [M in keyof TModules & string]: TDefaultLocale extends keyof TModules[M]
      ? `${M}.${keyof TModules[M][TDefaultLocale] & string}`
      : never
  }[keyof TModules & string]

  // 根据 namespaced key 查到的默认语言文案，用于推导占位符类型。
  type Message<TKey extends Key> = TKey extends `${infer M}.${infer K}`
    ? M extends ModuleName
      ? TDefaultLocale extends keyof TModules[M]
        ? K extends keyof TModules[M][TDefaultLocale]
          ? TModules[M][TDefaultLocale][K] & string
          : never
        : never
      : never
    : never

  const modulesByName = options.messages as Readonly<
    Record<string, Readonly<Record<string, I18nDictionary>>>
  >
  const moduleNames = Object.keys(modulesByName) as ModuleName[]
  const defaultLocale = options.defaultLocale

  // 汇总所有模块支持的语言。
  const localeSet = new Set<string>()
  for (const moduleName of moduleNames) {
    for (const locale of Object.keys(modulesByName[moduleName] ?? {})) {
      localeSet.add(locale)
    }
  }
  const supportedLocales = [...localeSet] as Locale[]

  // 默认语言下所有合法 `MODULE.SUBKEY` 集合，用于校验 token。
  const validKeys = new Set<string>()
  for (const moduleName of moduleNames) {
    const moduleMessages = modulesByName[moduleName]?.[defaultLocale]
    if (!moduleMessages) {
      continue
    }
    for (const subKey of Object.keys(moduleMessages)) {
      validKeys.add(`${moduleName}.${subKey}`)
    }
  }

  const getModuleDictionary = (
    moduleName: string,
  ): Readonly<Record<string, I18nDictionary>> | undefined =>
    modulesByName[moduleName] as Readonly<Record<string, I18nDictionary>> | undefined

  const normalizedLocales = new Map(
    supportedLocales.map((locale) => [normalizeLocale(locale), locale] as const),
  )

  const matchLocale = (
    requestedLocale: string,
    isAllowed: (locale: Locale) => boolean,
  ): Locale | undefined => {
    if (requestedLocale === '*') {
      return isAllowed(defaultLocale)
        ? defaultLocale
        : supportedLocales.find((locale) => isAllowed(locale))
    }

    let candidate = requestedLocale
    while (candidate) {
      const exactMatch = normalizedLocales.get(candidate)
      if (exactMatch && isAllowed(exactMatch)) {
        return exactMatch
      }

      const separatorIndex = candidate.lastIndexOf('-')
      if (separatorIndex < 0) {
        break
      }
      candidate = candidate.slice(0, separatorIndex)
    }

    return supportedLocales.find(
      (locale) => isAllowed(locale) && normalizeLocale(locale).startsWith(`${requestedLocale}-`),
    )
  }

  const detectLocale = (acceptLanguage?: string | null): Locale => {
    if (!acceptLanguage) {
      return defaultLocale
    }

    const preferences = parseAcceptLanguage(acceptLanguage)
    const rejectedPreferences = preferences.filter(({ quality }) => quality === 0)

    for (const preference of preferences) {
      if (preference.quality === 0) {
        continue
      }

      const isAllowed = (candidate: Locale) => {
        const normalizedLocale = normalizeLocale(candidate)
        return !rejectedPreferences.some(
          (rejected) =>
            rejected.specificity > preference.specificity &&
            (rejected.locale === '*' ||
              normalizedLocale === rejected.locale ||
              normalizedLocale.startsWith(`${rejected.locale}-`)),
        )
      }
      const locale = matchLocale(preference.locale, isAllowed)
      if (locale) {
        return locale
      }
    }
    return defaultLocale
  }

  const formatTranslation = (locale: Locale, key: Key, params?: I18nParams): string => {
    assertI18nParams(params)
    const parts = splitNamespacedKey(key)
    const moduleDicts = parts ? getModuleDictionary(parts.module) : undefined
    const message = parts
      ? (moduleDicts?.[locale]?.[parts.subKey] ??
        moduleDicts?.[defaultLocale]?.[parts.subKey] ??
        parts.subKey)
      : key
    return interpolate(message, params)
  }

  const translate = <TKey extends Key>(
    locale: Locale,
    key: TKey,
    ...[params]: I18nParamArgs<Message<TKey>>
  ): string => formatTranslation(locale, key, params)

  /**
   * 用于静态标注，使用场景例如 zod 或 throw Error 上，还需要拦截器对标注的KEY进行翻译
   *
   * 若需要直接返回翻译值，请在接口上使用
   * @example
   * ```ts
   * ({ i18n }) =>{
   *   return i18n.translate('COMMON.KEY')
   * }
   * ```
   * @param key
   * @param param1
   * @returns
   */
  const t = <TKey extends Key>(key: TKey, ...[params]: I18nParamArgs<Message<TKey>>): I18nToken => {
    assertI18nParams(params)
    return `${I18N_MESSAGE_PREFIX}${JSON.stringify({ key, params })}`
  }

  const getMessagePayload = (message: string): { key: Key; params?: I18nParams } | undefined => {
    if (!message.startsWith(I18N_MESSAGE_PREFIX)) {
      return undefined
    }

    try {
      const payload: unknown = JSON.parse(message.slice(I18N_MESSAGE_PREFIX.length))
      if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
        return undefined
      }

      const { key, params } = payload as { key?: unknown; params?: unknown }
      if (typeof key !== 'string' || !validKeys.has(key)) {
        return undefined
      }
      if (params !== undefined && !isI18nParams(params)) {
        return undefined
      }

      return { key: key as Key, params }
    } catch {
      return undefined
    }
  }

  /**
   * 用于直接转换 i18n
   *
   *
   * @param message
   * @param acceptLanguage
   * @returns message
   * @example
   * ```ts
   * translateMessage('COMMON.KEY', 'zh')
   * ```
   */
  const translateMessage: TranslateMessageFn = (message, acceptLanguage) => {
    const payload = getMessagePayload(message)
    if (!payload) {
      return undefined
    }

    const locale = detectLocale(acceptLanguage)
    return {
      key: payload.key,
      locale,
      message: formatTranslation(locale, payload.key, payload.params),
    }
  }

  const i18nPlugin = new Elysia({ name: 'i18n-plugin' })
    // 响应头必须在 transform 阶段写入：Elysia 2 中 `derive` 在校验之后执行，
    // 校验失败时不会执行，会导致错误响应缺少 `Content-Language`
    .onTransform('global', ({ request, set }) => {
      const locale = detectLocale(request.headers.get('accept-language'))
      set.headers['vary'] = mergeVaryHeader(set.headers['vary'], 'Accept-Language')
      set.headers['content-language'] = locale
    })
    .derive('global', ({ request }) => {
      const locale = detectLocale(request.headers.get('accept-language'))

      return {
        i18n: {
          locale,
          translate: <TKey extends Key>(key: TKey, ...[params]: I18nParamArgs<Message<TKey>>) =>
            formatTranslation(locale, key, params),
        },
      }
    })

  return {
    i18nPlugin,
    t,
    detectLocale,
    translate,
    translateMessage,
  }
}
