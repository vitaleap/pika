import { Elysia } from 'elysia'

const DOT = ','
const parseIp = (ip: string | null): string | undefined => {
  if (!ip) return undefined
  // x-forwarded-for 可能包含多个 IP，取第一个
  if (ip.includes(DOT)) {
    return ip.split(DOT)[0]?.trim()
  }
  return ip.trim()
}

/**
 * 获取请求 IP 插件
 * 默认从 `x-forwarded-for` 和 `x-real-ip` Header 获取，适用于反向代理场景。
 * 注意：在生产环境中，应该配置信任的代理 IP，否则可能被伪造。
 * @param options 可选项 { headers?: string | string[] }
 */
export const requestIpPlugin = (
  options: {
    headers?: string | string[] // 可选的自定义 Header 名称
  } = {},
) =>
  new Elysia({
    name: 'request-ip-plugin',
  }).derive('plugin', ({ request, server }) => {
    const opts = {
      // 优先 x-real-ip
      headers: ['x-real-ip', 'x-forwarded-for'],
    }
    if (options.headers !== undefined) {
      opts.headers = Array.isArray(options.headers) ? options.headers : [options.headers]
    }
    return {
      /**
       * 请求 IP 地址
       */
      get requestIp(): string {
        for (const header of opts.headers) {
          const ip = parseIp(request.headers.get(header))
          if (ip) {
            return ip
          }
        }
        return server?.requestIP(request)?.address || 'unknown'
      },
    }
  })
