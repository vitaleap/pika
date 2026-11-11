import dayjs from 'dayjs'
import { treaty } from '@elysia/eden'
import { type Api, startApp } from '@/app'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { cache } from '@/common/cache'
import { UserRepository } from '@/system/repositories/user'
import { hashPassword } from '@/common/utils/crypto'

const adminEmail = 'admin-48523@gmail.com'
const updatedAdminEmail = 'former-admin-48523@gmail.com'
const password = 'Admin123456'

describe('adminRouter', () => {
  let appHandle!: Awaited<ReturnType<typeof startApp>>
  let api!: ReturnType<typeof treaty<Api>>
  let adminUserId!: string
  let originalAdminEmail: string | undefined

  beforeAll(async () => {
    // 快照并设置 ADMIN_EMAIL，auth 插件运行时读取
    originalAdminEmail = process.env['ADMIN_EMAIL']
    process.env['ADMIN_EMAIL'] = adminEmail

    appHandle = await startApp({ port: 48523 })
    api = treaty<Api>(appHandle.baseUrl)

    // 容错清理残留数据：上次失败遗留的 admin 用户会造成 unique 冲突
    for (const email of [adminEmail, updatedAdminEmail]) {
      const existing = await UserRepository.findByEmail(email).catch(() => null)
      if (existing) await UserRepository.removeById(existing.id).catch(() => {})
    }

    adminUserId = (
      await UserRepository.save({
        name: 'admin',
        email: adminEmail,
        emailVerified: true,
        password: await hashPassword(password),
        createAt: dayjs(),
      })
    ).id
  })

  afterAll(async () => {
    if (adminUserId) {
      await UserRepository.removeById(adminUserId).catch(() => {})
    }
    await appHandle.app.stop()
    if (originalAdminEmail === undefined) {
      delete process.env['ADMIN_EMAIL']
    } else {
      process.env['ADMIN_EMAIL'] = originalAdminEmail
    }
  })

  const getTokenInfo = async () => {
    const { data } = await api.system.oauth.token.post({
      grant_type: 'password',
      username: adminEmail,
      password,
    })
    expect(data).not.toBeNull()
    return data!
  }

  const getUserInfo = (accessToken: string) =>
    api.system.oauth.userinfo.get({
      headers: { Authorization: `Bearer ${accessToken}` },
    })

  const getAdminConfig = (accessToken?: string) =>
    api.system.admin.config.get({
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    })

  test('更新配置时校验合并后的完整配置', async () => {
    const adminTokenInfo = await getTokenInfo()
    const headers = { Authorization: `Bearer ${adminTokenInfo.access_token}` }
    const { data: before } = await getAdminConfig(adminTokenInfo.access_token)

    try {
      // 重置为默认配置（mail 关闭且无历史凭据），确保非法更新必然缺少必填参数
      const { status: resetStatus } = await api.system.admin.config.reset.post(undefined, {
        headers,
      })
      expect(resetStatus).toBe(200)

      const { status } = await api.system.admin.config.patch(
        { mail: { enabled: true } },
        { headers },
      )
      expect(status).toBe(422)

      const { data: after, status: getStatus } = await getAdminConfig(adminTokenInfo.access_token)
      expect(getStatus).toBe(200)
      expect(after?.mail).toEqual({ enabled: false })
    } finally {
      // 恢复原始配置，避免污染共享测试库
      await api.system.admin.config.patch(
        { auth: before!.auth, mail: before!.mail, file: before!.file },
        { headers },
      )
    }
  })

  test('管理员权限按当前用户邮箱实时判断', async () => {
    const { status: anonymousStatus } = await getAdminConfig()
    expect(anonymousStatus).toBe(401)

    const adminTokenInfo = await getTokenInfo()
    const { data: adminInfo } = await getUserInfo(adminTokenInfo.access_token)
    expect(adminInfo?.roles).toEqual(['admin'])

    const { status: successStatus } = await getAdminConfig(adminTokenInfo.access_token)
    expect(successStatus).toBe(200)

    await UserRepository.updateById(adminUserId, { email: updatedAdminEmail })
    await cache.del(adminUserId)

    const { status: revokedAccessStatus } = await getAdminConfig(adminTokenInfo.access_token)
    expect(revokedAccessStatus).toBe(403)

    const { data: refreshedTokenInfo, status: refreshStatus } = await api.system.oauth.token.post({
      grant_type: 'refresh_token',
      refresh_token: adminTokenInfo.refresh_token,
    })
    expect(refreshStatus).toBe(200)
    expect(refreshedTokenInfo).not.toBeNull()

    const refreshedAccessToken = refreshedTokenInfo!.access_token
    const { data: currentUserInfo } = await getUserInfo(refreshedAccessToken)
    expect(currentUserInfo?.email).toBe(updatedAdminEmail)
    expect(currentUserInfo?.roles).toEqual([])

    const { status: refreshedAccessStatus } = await getAdminConfig(refreshedAccessToken)
    expect(refreshedAccessStatus).toBe(403)
  })
})
