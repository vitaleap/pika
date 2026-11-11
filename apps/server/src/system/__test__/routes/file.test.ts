import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { treaty } from '@elysia/eden'
import { type Api, startApp } from '@/app'
import { ConfigService } from '@/system/services/config'
import { afterAll, describe, expect, test } from 'bun:test'

// 上传目录由 .env.test 的 FILE_PATH 指定；config.ts 在模块顶层快照配置，在此处赋值已太晚
const uploadPath = resolve(process.cwd(), '.tmp/test-file-uploads')

/**
 * 假对象存储：仅实现 HEAD / GET，代替真实 OSS 被服务端访问。
 *
 * 能验证：服务端是否按配置走 OSS 直链 / 代理分支、302 响应头、直链签名参数、缓存键。
 * 不能验证：签名在真实 OSS 上的有效性、存储端是否真的应用 `response-content-disposition`
 * （这两项需要真实凭证，不适合放在单测里）。
 * 记录请求是为了让用例能断言“确实访问了配置的端点”，避免配置没生效时用例空跑通过。
 */
const storedBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
const fakeOssRequests: string[] = []
const fakeOss = Bun.serve({
  port: 0,
  fetch(req) {
    const key = new URL(req.url).pathname.split('/').at(-1) ?? ''
    fakeOssRequests.push(`${req.method} ${key}`)
    if (!/^[0-9]+\.png$/.test(key)) {
      return new Response(null, { status: 404 })
    }
    return new Response(req.method === 'HEAD' ? null : storedBytes, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': String(storedBytes.byteLength),
      },
    })
  },
})

await rm(uploadPath, { recursive: true, force: true })
const { app, baseUrl } = await startApp({ port: 48522 })
const api = treaty<Api>(baseUrl)

afterAll(async () => {
  await app.stop()
  fakeOss.stop()
  await rm(uploadPath, { recursive: true, force: true })
})

const uploadFile = async (file: File, accessToken?: string) => {
  return api.system.file.upload.post(
    { file },
    {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    },
  )
}

const getAccessToken = async (): Promise<string> => {
  const { data } = await api.system.oauth.token.post({
    grant_type: 'password',
    username: 'test',
    password: 'test',
  })
  expect(data).not.toBeNull()
  return data!.access_token
}

describe('fileRouter', () => {
  test('上传需要认证并默认拒绝危险文件', async () => {
    const html = new File(['<script>alert(1)</script>'], 'review.html', {
      type: 'text/html',
    })

    const anonymousResponse = await uploadFile(html)
    expect(anonymousResponse.status).toBe(401)

    const accessToken = await getAccessToken()
    const dangerousResponse = await uploadFile(html, accessToken)
    expect(dangerousResponse.status).toBe(415)
  })

  test('合法文件可上传且下载时不会内联执行', async () => {
    const accessToken = await getAccessToken()
    const image = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'avatar.png', {
      type: 'image/png',
    })
    const { data: uploaded, response: uploadResponse } = await uploadFile(image, accessToken)
    expect(uploadResponse.status).toBe(200)
    expect(uploaded).not.toBeNull()

    const filename = uploaded!.url.split('/').at(-1)!
    const { response: downloadResponse, status: downloadStatus } = await api.system
      .file({ filename })
      .get()
    expect(downloadStatus).toBe(200)
    expect(downloadResponse.headers.get('content-disposition')).toMatch(
      /^attachment; filename="[0-9]+\.png"$/,
    )
    expect(downloadResponse.headers.get('x-content-type-options')).toBe('nosniff')
  })

  test('后台修改文件配置后无需重启即生效', async () => {
    const accessToken = await getAccessToken()
    const { file: originalFile } = await ConfigService.get()
    // size 用于超过尺寸上限的用例
    const html = (size = 20) =>
      new File([`<script>alert(1)</script>`.padEnd(size, ' ')], 'reload.html', {
        type: 'text/html',
      })
    const withHtml = {
      ...originalFile,
      allowedTypes: [...originalFile.allowedTypes, 'text/html'],
    }

    try {
      // 白名单未放开前应被拒绝
      expect((await uploadFile(html(), accessToken)).status).toBe(415)

      // 放开 text/html：校验插件应重建，立即生效
      await ConfigService.update({ file: withHtml })
      expect((await uploadFile(html(), accessToken)).status).toBe(200)

      // 收紧尺寸上限（配置下限 1KB）：同样立即生效
      await ConfigService.update({ file: { ...withHtml, maxSize: 1024 } })
      expect((await uploadFile(html(2048), accessToken)).status).toBe(413)
    } finally {
      await ConfigService.update({ file: originalFile })
    }
  })

  test('下载不存在的文件返回 404', async () => {
    const { status } = await api.system.file({ filename: '9999999999999999999.png' }).get()
    expect(status).toBe(404)
  })

  describe('对象存储直链', () => {
    // 每个用例用不同文件名，避免命中上一个用例留下的直链缓存
    const ossConfig = {
      ossEnabled: true as const,
      ossEndpoint: `http://127.0.0.1:${fakeOss.port}`,
      ossBucket: 'test-bucket',
      ossAccessKeyId: 'test-access-key',
      ossSecretAccessKey: 'test-secret-key',
      ossRegion: 'us-east-1',
      ossForcePathStyle: true,
      ossDefaultUrlExpiresIn: 600,
      ossHideFileUrl: false,
    }
    // redirect: manual，避免 fetch 跟随 302 到假对象存储
    const fetchFile = (filename: string) =>
      fetch(`${baseUrl}/system/file/${filename}`, { redirect: 'manual' })

    test('未隐藏文件 URL 时 302 跳转到强制附件下载的直链', async () => {
      const filename = '1712345678901.png'
      const { file: originalFile } = await ConfigService.get()
      fakeOssRequests.length = 0
      try {
        await ConfigService.update({ file: ossConfig })
        const response = await fetchFile(filename)
        expect(response.status).toBe(302)
        // 确实访问了配置的端点（先探测存在性再签名），避免配置没生效时空跑通过
        expect(fakeOssRequests).toContain(`HEAD ${filename}`)
        const location = decodeURIComponent(response.headers.get('location') ?? '')
        expect(location).toContain(`/test-bucket/${filename}?`)
        expect(location).toContain('X-Amz-Signature=')
        // 直链必须带附件语义，否则上传的 html/svg 会在存储域名下内联执行
        expect(location).toContain(
          `response-content-disposition=attachment; filename="${filename}"`,
        )
        expect(response.headers.get('cache-control')).toBe('public, max-age=540')
      } finally {
        await ConfigService.update({ file: originalFile })
      }
    })

    test('直链缓存只在存储位置变更时失效', async () => {
      const filename = '1712345678902.png'
      const { file: originalFile } = await ConfigService.get()
      fakeOssRequests.length = 0
      const headCount = () => fakeOssRequests.filter((req) => req === `HEAD ${filename}`).length
      try {
        await ConfigService.update({ file: ossConfig })
        const first = new URL((await fetchFile(filename)).headers.get('location')!)
        expect(first.searchParams.get('X-Amz-Expires')).toBe('600')
        expect(headCount()).toBe(1)

        // 过期时间在签发时就写进了直链，改配置不影响已颁发的直链，继续复用缓存即可
        await ConfigService.update({ file: { ...ossConfig, ossDefaultUrlExpiresIn: 900 } })
        const cached = new URL((await fetchFile(filename)).headers.get('location')!)
        expect(cached.toString()).toBe(first.toString())
        expect(headCount()).toBe(1)

        // 换桶后旧直链指向错误位置，必须换键重新签名
        await ConfigService.update({ file: { ...ossConfig, ossBucket: 'another-bucket' } })
        const second = new URL((await fetchFile(filename)).headers.get('location')!)
        expect(second.pathname).toContain('/another-bucket/')
        // 重新探测对象才能重新签名，HEAD 从 1 变成 2 证明确实未命中旧缓存
        expect(headCount()).toBe(2)
      } finally {
        await ConfigService.update({ file: originalFile })
      }
    })

    test('隐藏文件 URL 时由服务端代理下载且强制附件', async () => {
      const filename = '1712345678903.png'
      const { file: originalFile } = await ConfigService.get()
      fakeOssRequests.length = 0
      try {
        await ConfigService.update({ file: { ...ossConfig, ossHideFileUrl: true } })
        const response = await fetchFile(filename)
        expect(response.status).toBe(200)
        expect(fakeOssRequests).toContain(`GET ${filename}`)
        expect(response.headers.get('content-disposition')).toBe(
          `attachment; filename="${filename}"`,
        )
        expect(response.headers.get('x-content-type-options')).toBe('nosniff')
        expect(new Uint8Array(await response.arrayBuffer())).toEqual(storedBytes)
      } finally {
        await ConfigService.update({ file: originalFile })
      }
    })
  })
})
