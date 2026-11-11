import { Elysia } from 'elysia'
import { t } from '@/common/plugins/i18n'
import { FileService } from '@/system/services/file'
import { auth } from '@/common/plugins/auth'
import { rateLimit } from '@/common/rate-limit'

export const fileRouter = new Elysia({
  prefix: '/file',
  detail: {
    tags: ['file'],
    security: [{ 'HTTP Bearer': [] }],
  },
})
  .use(
    auth({
      // 只有 upload 路由需要鉴权
      basePath: '/file',
      includePaths: ['/upload'],
    }),
  )
  .get(
    '/avatar/:filename',
    {
      detail: {
        operationId: 'getAvatarFile',
        summary: 'Get avatar file stream',
      },
      params: FileService.GetAvatarParamsSchema,
    },
    async ({ params }) => {
      const file = await fetch(
        `${Bun.env['GAVATAR_BASE_URL'] || 'https://gravatar.com'}/avatar/${params.filename}?d=mp&s=120`,
      )
      return new Response(file.body, {
        headers: {
          'Content-Type': file.headers.get('content-type') || 'image/png',
          'Cache-Control': 'public, max-age=172800',
          // 覆盖 @elysia/cors 默认写入的 Vary: *，让响应可被 CDN/浏览器缓存
          Vary: 'Accept-Encoding',
        },
      })
    },
  )
  .get(
    '/:filename',
    {
      detail: {
        operationId: 'getFile',
        summary: 'Get file stream',
      },
      params: FileService.GetParamsSchema,
    },
    async ({ params }) => {
      const result = await FileService.get(params)
      // 对象存储未隐藏文件 URL：302 跳转到直链，客户端直连存储下载
      if (result.type === 'url') {
        return new Response(null, {
          status: 302,
          headers: {
            Location: result.url,
            // 跳转缓存上限取直链剩余有效期，留 60s 余量避免缓存到即将过期的直链
            'Cache-Control': `public, max-age=${Math.max(result.expiresIn - 60, 0)}`,
          },
        })
      }
      const file = result.file
      return new Response(file.stream(), {
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${params.filename}"`,
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'public, max-age=3600',
        },
      })
    },
  )
  .post(
    '/upload',
    {
      detail: {
        operationId: 'upload',
        summary: 'Upload file',
        security: [{ 'HTTP Bearer': [] }],
      },
      parse: 'multipart/form-data',
      body: FileService.UploadBodySchema,
      response: FileService.UploadRespSchema,
    },
    async ({ body, user }) => {
      await rateLimit(
        {
          minute10: 20,
          hour: 50,
          day: 80,
          errorMessage: t('SYSTEM.UPLOAD_RATE_LIMITED'),
        },
        `upload:${user.sub}`,
      )
      return FileService.upload(body)
    },
  )
