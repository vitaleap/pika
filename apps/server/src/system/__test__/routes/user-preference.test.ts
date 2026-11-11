import dayjs from 'dayjs'
import { treaty } from '@elysia/eden'
import { type Api, startApp } from '@/app'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { UserRepository } from '@/system/repositories/user'
import { UserPreferenceRepository } from '@/system/repositories/user-preference'
import { hashPassword } from '@/common/utils/crypto'

const email = 'preference-48532@gmail.com'
const password = 'Preference123456'

const appearance = {
  light: {
    sidebarBgColor: '255 255 255',
    sidebarBgTransparency: '0.9',
    mainBgType: 'wallpaper',
    mainBgImageUrl: '',
    mainBgBlur: 4,
  },
  dark: {
    sidebarBgColor: '21 21 25',
    sidebarBgTransparency: '0.95',
    mainBgType: 'image',
    mainBgImageUrl: '/api/system/file/background-48532.png',
    mainBgBlur: 8,
  },
} as const

describe('用户外观风格设定', () => {
  let appHandle!: Awaited<ReturnType<typeof startApp>>
  let api!: ReturnType<typeof treaty<Api>>
  let userId!: string
  let headers!: { Authorization: string }

  beforeAll(async () => {
    appHandle = await startApp({ port: 48532 })
    api = treaty<Api>(appHandle.baseUrl)

    const existing = await UserRepository.findByEmail(email).catch(() => null)
    if (existing) await UserRepository.removeById(existing.id).catch(() => {})

    userId = (
      await UserRepository.save({
        name: 'preference',
        email,
        emailVerified: true,
        password: await hashPassword(password),
        createAt: dayjs(),
      })
    ).id

    const { data } = await api.system.oauth.token.post({
      grant_type: 'password',
      username: email,
      password,
    })
    headers = { Authorization: `Bearer ${data!.access_token}` }
  })

  afterAll(async () => {
    if (userId) {
      await UserPreferenceRepository.removeByUserId(userId).catch(() => {})
      await UserRepository.removeById(userId).catch(() => {})
    }
    await appHandle.app.stop()
  })

  test('未登录无法访问', async () => {
    const { status } = await api.system.user.preference.get()
    expect(status).toBe(401)
  })

  test('未保存过时不落库默认值，appearance 为 null', async () => {
    await UserPreferenceRepository.removeByUserId(userId)

    const { data, status } = await api.system.user.preference.get({ headers })
    expect(status).toBe(200)
    // 默认值只在前端维护，服务端不保存默认值
    expect(data?.appearance).toBeNull()
    expect(await UserPreferenceRepository.findByUserId(userId)).toBeUndefined()
  })

  test('省略 mainBgType 时按默认值 color 保存', async () => {
    const { light, dark } = appearance
    const { mainBgType: _lightType, ...lightWithoutType } = light
    const { mainBgType: _darkType, ...darkWithoutType } = dark

    const { data, status } = await api.system.user.preference.post(
      // 故意省略 mainBgType，验证服务端补默认值（zod 的 default 使输入类型可选）
      { appearance: { light: lightWithoutType, dark: darkWithoutType } },
      { headers },
    )
    expect(status).toBe(200)
    expect(data?.appearance.light.mainBgType).toBe('color')
    expect(data?.appearance?.dark.mainBgType).toBe('color')
  })

  test('保存后可再次读取', async () => {
    const { data, status } = await api.system.user.preference.post({ appearance }, { headers })
    expect(status).toBe(200)
    expect(data?.appearance).toEqual(appearance)

    const { data: saved } = await api.system.user.preference.get({ headers })
    expect(saved?.appearance).toEqual(appearance)
  })

  test('再次保存会覆盖已存风格', async () => {
    // 用例自包含，不依赖其他用例的写入结果
    await api.system.user.preference.post({ appearance }, { headers })

    const updated = {
      ...appearance,
      dark: { ...appearance.dark, mainBgBlur: 12 },
    }
    const { status } = await api.system.user.preference.post({ appearance: updated }, { headers })
    expect(status).toBe(200)

    const { data } = await api.system.user.preference.get({ headers })
    // 已存值被提交值整体覆盖，且明亮与暗黑两套互不影响
    expect(data?.appearance?.dark.mainBgBlur).toBe(12)
    expect(data?.appearance?.light).toEqual(appearance.light)
  })

  test('切换背景类型时自定义图片地址原样保存', async () => {
    const custom = {
      ...appearance,
      dark: { ...appearance.dark, mainBgType: 'color' as const },
    }
    const { status } = await api.system.user.preference.post({ appearance: custom }, { headers })
    expect(status).toBe(200)

    const { data } = await api.system.user.preference.get({ headers })
    expect(data?.appearance?.dark.mainBgType).toBe('color')
    // 类型切回纯色后，图片地址仍按提交值保存，方便用户随时切回
    expect(data?.appearance?.dark.mainBgImageUrl).toBe('/api/system/file/background-48532.png')
  })

  test('背景图可清除（空字符串）', async () => {
    const cleared = {
      ...appearance,
      dark: { ...appearance.dark, mainBgType: 'color' as const, mainBgImageUrl: '' },
    }
    const { status } = await api.system.user.preference.post({ appearance: cleared }, { headers })
    expect(status).toBe(200)

    const { data } = await api.system.user.preference.get({ headers })
    expect(data?.appearance?.dark.mainBgImageUrl).toBe('')
  })

  test('非法风格被拒绝', async () => {
    const { status: colorStatus } = await api.system.user.preference.post(
      {
        appearance: {
          ...appearance,
          dark: { ...appearance.dark, sidebarBgColor: '21-21-25' },
        },
      },
      { headers },
    )
    expect(colorStatus).toBe(422)

    // 明亮与暗黑两套风格必须同时提交
    const { status: missingStatus } = await api.system.user.preference.post(
      // @ts-expect-error 故意缺少 dark 字段，验证服务端校验
      { appearance: { light: appearance.light } },
      { headers },
    )
    expect(missingStatus).toBe(422)

    // 外观风格必须整体提交，空对象不被接受
    const { status: emptyStatus } = await api.system.user.preference.post(
      // @ts-expect-error 故意提交空对象，验证服务端校验
      {},
      { headers },
    )
    expect(emptyStatus).toBe(422)
  })
})
