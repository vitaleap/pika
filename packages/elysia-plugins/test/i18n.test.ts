import { describe, expect, test } from 'bun:test'
import { Elysia } from 'elysia'
import { createElysiaI18n, type I18nLocaleMessages } from '../src/i18n'

const commonZh = {
  FORBIDDEN: '禁止访问',
  VALIDATE_NUM: '长度在 {min} 到 {max} 之间，最小值为 {min}',
} as const

const commonEn = {
  FORBIDDEN: 'Forbidden',
  VALIDATE_NUM: 'Length must be between {min} and {max}; minimum is {min}',
} satisfies I18nLocaleMessages<typeof commonZh>

const systemZh = {
  USER_NOT_FOUND: '用户不存在',
  UNAUTHORIZED: '未授权',
} as const

const systemEn = {
  USER_NOT_FOUND: 'User not found',
  UNAUTHORIZED: 'Unauthorized',
} satisfies I18nLocaleMessages<typeof systemZh>

const i18n = createElysiaI18n({
  defaultLocale: 'zh',
  messages: {
    COMMON: { zh: commonZh, en: commonEn },
    SYSTEM: { zh: systemZh, en: systemEn },
  },
})

const checkParamTypes = () => {
  i18n.t('SYSTEM.USER_NOT_FOUND')
  i18n.t('COMMON.VALIDATE_NUM', { min: 6, max: 12 })
  // @ts-expect-error 无参数 key 不接受参数
  i18n.t('SYSTEM.USER_NOT_FOUND', {})
  // @ts-expect-error 带占位符的 key 必须传入参数
  i18n.t('COMMON.VALIDATE_NUM')
  // @ts-expect-error 参数不能缺少占位符
  i18n.t('COMMON.VALIDATE_NUM', { min: 6 })
  // @ts-expect-error 参数不能多于占位符
  i18n.t('COMMON.VALIDATE_NUM', { min: 6, max: 12, step: 1 })
  // @ts-expect-error 参数值只支持字符串和数字
  i18n.t('COMMON.VALIDATE_NUM', { min: true, max: 12 })
  // @ts-expect-error 未注册的模块不被允许
  i18n.t('PAYMENT.X')
  // @ts-expect-error 未注册的子 key 不被允许
  i18n.t('SYSTEM.UNKNOWN_KEY')
}

void checkParamTypes

describe('createElysiaI18n', () => {
  test('生成延迟翻译标记', () => {
    expect(i18n.t('SYSTEM.USER_NOT_FOUND')).toBe('i18n:{"key":"SYSTEM.USER_NOT_FOUND"}')
    expect(i18n.t('COMMON.VALIDATE_NUM', { min: 6, max: 12 })).toBe(
      'i18n:{"key":"COMMON.VALIDATE_NUM","params":{"min":6,"max":12}}',
    )
  })

  test('根据权重、排除规则和地区代码检测语言', () => {
    expect(i18n.detectLocale('zh;q=0.5,en-US;q=0.9')).toBe('en')
    expect(i18n.detectLocale('zh;q=0,*;q=1')).toBe('en')
    expect(i18n.detectLocale('zh;q=0,en;q=0.5,*;q=1')).toBe('en')
    expect(i18n.detectLocale('en;q=1,*;q=0')).toBe('en')
    expect(i18n.detectLocale('zh;q=0,en;q=0')).toBe('zh')
    expect(i18n.detectLocale('zh-CN')).toBe('zh')
    expect(i18n.detectLocale('fr-FR')).toBe('zh')
  })

  test('按模块路由翻译不同模块下的同名 key', () => {
    expect(i18n.translate('zh', 'SYSTEM.USER_NOT_FOUND')).toBe('用户不存在')
    expect(i18n.translate('en', 'SYSTEM.USER_NOT_FOUND')).toBe('User not found')
    expect(i18n.translate('zh', 'COMMON.VALIDATE_NUM', { min: 6, max: 12 })).toBe(
      '长度在 6 到 12 之间，最小值为 6',
    )
    expect(i18n.translate('en', 'COMMON.VALIDATE_NUM', { min: 6, max: 12 })).toBe(
      'Length must be between 6 and 12; minimum is 6',
    )
  })

  test('仅翻译字典中存在的标记', () => {
    expect(i18n.translateMessage('i18n:{"key":"SYSTEM.USER_NOT_FOUND"}', 'en-US')).toEqual({
      key: 'SYSTEM.USER_NOT_FOUND',
      locale: 'en',
      message: 'User not found',
    })
    expect(
      i18n.translateMessage(
        'i18n:{"key":"COMMON.VALIDATE_NUM","params":{"min":6,"max":12}}',
        'en-US',
      ),
    ).toEqual({
      key: 'COMMON.VALIDATE_NUM',
      locale: 'en',
      message: 'Length must be between 6 and 12; minimum is 6',
    })
    expect(i18n.translateMessage('plain message', 'en')).toBeUndefined()
    expect(i18n.translateMessage('i18n:{"key":"PAYMENT.X"}', 'en')).toBeUndefined()
    expect(i18n.translateMessage('i18n:{"key":"SYSTEM.UNKNOWN"}', 'en')).toBeUndefined()
    expect(
      i18n.translateMessage(
        'i18n:{"key":"COMMON.VALIDATE_NUM","params":{"min":null,"max":12}}',
        'en',
      ),
    ).toBeUndefined()
    expect(i18n.translateMessage('i18n:invalid-json', 'en')).toBeUndefined()
  })

  test('拒绝非有限数字参数', async () => {
    expect(() => i18n.t('COMMON.VALIDATE_NUM', { min: Number.NaN, max: 12 })).toThrow(TypeError)
    expect(() =>
      i18n.translate('zh', 'COMMON.VALIDATE_NUM', { min: 6, max: Number.POSITIVE_INFINITY }),
    ).toThrow(TypeError)

    const app = new Elysia().use(i18n.i18nPlugin).get('/', ({ i18n }) => {
      expect(() =>
        i18n.translate('COMMON.VALIDATE_NUM', { min: Number.NEGATIVE_INFINITY, max: 12 }),
      ).toThrow(TypeError)
      return 'ok'
    })
    const response = await app.handle(new Request('http://localhost/'))
    expect(response.status).toBe(200)
  })

  test('合并已有 Vary 响应头', async () => {
    const app = new Elysia()
      .onRequest(({ request, set }) => {
        const vary = request.headers.get('x-existing-vary')
        if (vary) {
          set.headers['vary'] = vary
        }
      })
      .use(i18n.i18nPlugin)
      .get('/', () => 'ok')

    const getVary = async (existingVary?: string) => {
      const headers = existingVary ? { 'x-existing-vary': existingVary } : undefined
      const response = await app.handle(new Request('http://localhost/', { headers }))
      return response.headers.get('vary')
    }

    expect(await getVary()).toBe('Accept-Language')
    expect(await getVary('Origin')).toBe('Origin, Accept-Language')
    expect(await getVary('Origin, accept-language, origin')).toBe('Origin, accept-language')
    expect(await getVary('*')).toBe('*')
  })

  test('向请求上下文和响应头注入语言信息', async () => {
    const app = new Elysia().use(i18n.i18nPlugin).get('/', ({ i18n }) => ({
      locale: i18n.locale,
      message: i18n.translate('SYSTEM.UNAUTHORIZED'),
      range: i18n.translate('COMMON.VALIDATE_NUM', { min: 6, max: 12 }),
    }))

    const response = await app.handle(
      new Request('http://localhost/', {
        headers: { 'Accept-Language': 'en-GB' },
      }),
    )

    expect(response.headers.get('content-language')).toBe('en')
    expect(response.headers.get('vary')).toContain('Accept-Language')
    expect(await response.json()).toEqual({
      locale: 'en',
      message: 'Unauthorized',
      range: 'Length must be between 6 and 12; minimum is 6',
    })
  })
})
