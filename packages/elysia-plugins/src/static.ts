import { Elysia } from 'elysia'
import { join, normalize, relative, sep } from 'node:path'

export type StaticPluginOpts = {
  /** 静态资源根目录，默认 `${cwd}/web` */
  root?: string
  /** API 路径前缀，命中后跳过本插件由 API 子应用处理，默认 `/api` */
  basePath?: string
}

const LONG_CACHE_EXTS = new Set(['js', 'css'])
const SHORT_CACHE_EXTS = new Set([
  'map',
  'woff',
  'woff2',
  'ttf',
  'otf',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'svg',
  'ico',
  'webp',
  'avif',
  'lottie',
])

const LONG_CACHE = 'public, max-age=2592000, immutable'
const SHORT_CACHE = 'public, max-age=86400, immutable'

const acceptsGzip = (header: string | null): boolean => {
  if (!header) {
    return false
  }

  let wildcardQuality: number | undefined
  let identityQuality: number | undefined
  for (const value of header.toLowerCase().split(',')) {
    const [name, ...parameters] = value.split(';').map((part) => part.trim())
    const qualityValue = parameters.find((parameter) => parameter.startsWith('q='))?.slice(2)
    const quality = qualityValue === undefined ? 1 : Number(qualityValue)

    if (name === 'gzip') {
      return quality > 0
    }
    if (name === 'identity' && identityQuality === undefined) {
      identityQuality = quality
    }
    if (name === '*' && wildcardQuality === undefined) {
      wildcardQuality = quality
    }
  }

  // RFC 7231: identity 表示不需要任何编码，q>0 时优先于 wildcard
  if (identityQuality !== undefined && identityQuality > 0) {
    return false
  }
  return (wildcardQuality ?? 0) > 0
}

/** 生产环境前端静态资源与 SPA fallback 插件。 */
export const staticPlugin = (opts?: StaticPluginOpts) => {
  const root = normalize(opts?.root ?? join(process.cwd(), 'web'))
  const basePath = opts?.basePath ?? '/api'

  const resolveSafePath = (rawPathname: string): string | null => {
    let pathname: string
    try {
      pathname = decodeURIComponent(rawPathname)
    } catch {
      return null
    }
    if (!pathname.startsWith('/')) {
      return null
    }

    const resolvedPath = normalize(join(root, pathname))
    const relativePath = relative(root, resolvedPath)
    if (relativePath === '..' || relativePath.startsWith(`..${sep}`)) {
      return null
    }
    return resolvedPath
  }

  const cacheControlFor = (path: string): string | null => {
    const extensionIndex = path.lastIndexOf('.')
    if (extensionIndex < 0) {
      return null
    }
    const extension = path.slice(extensionIndex + 1).toLowerCase()
    if (LONG_CACHE_EXTS.has(extension)) {
      return LONG_CACHE
    }
    if (SHORT_CACHE_EXTS.has(extension)) {
      return SHORT_CACHE
    }
    return null
  }

  const serveStatic = async (pathname: string): Promise<Response | null> => {
    const file = Bun.file(pathname)
    if (!(await file.exists())) {
      return null
    }
    try {
      if ((await file.stat())?.isDirectory()) {
        return null
      }
      const headers = new Headers({
        'Content-Type': file.type || 'application/octet-stream',
        Vary: 'Accept-Encoding',
      })
      const cacheControl = cacheControlFor(pathname)
      if (cacheControl) {
        headers.set('Cache-Control', cacheControl)
      }
      return new Response(file, { headers })
    } catch (error) {
      console.error(error)
      return null
    }
  }

  const tryGzip = async (pathname: string, baseHeaders: Headers): Promise<Response | null> => {
    const gzFile = Bun.file(`${pathname}.gz`)
    if (!(await gzFile.exists())) {
      return null
    }
    const headers = new Headers(baseHeaders)
    headers.set('Content-Encoding', 'gzip')
    return new Response(gzFile, { headers })
  }

  const serveIndex = async (): Promise<Response> => {
    const file = Bun.file(join(root, 'index.html'))
    if (!(await file.exists())) {
      return new Response('Not Found', { status: 404 })
    }
    return new Response(file, {
      headers: {
        'Content-Type': file.type || 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    })
  }

  return new Elysia({ name: 'static-plugin' }).all('/*', async ({ request, path: requestPath }) => {
    if (requestPath === basePath || requestPath.startsWith(`${basePath}/`)) {
      return undefined
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: { Allow: 'GET, HEAD' },
      })
    }

    if (requestPath === '/') {
      return serveIndex()
    }

    const pathname = resolveSafePath(requestPath)
    if (!pathname) {
      return undefined
    }

    const staticResponse = await serveStatic(pathname)
    if (staticResponse && !acceptsGzip(request.headers.get('accept-encoding'))) {
      return staticResponse
    }
    if (staticResponse) {
      return (await tryGzip(pathname, staticResponse.headers)) ?? staticResponse
    }

    const acceptsHtml = request.headers.get('accept')?.includes('text/html')
    const fetchMode = request.headers.get('sec-fetch-mode')

    // 仅 HTML 页面导航回退首页，缺失的脚本、图片等资源应返回 404。
    if (!acceptsHtml || (fetchMode && fetchMode !== 'navigate')) {
      return new Response('Not Found', { status: 404 })
    }
    return serveIndex()
  })
}
