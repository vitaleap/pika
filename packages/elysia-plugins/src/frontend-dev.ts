import { Elysia } from 'elysia'
import { websocket } from 'elysia/websocket'

export type FrontendDevPluginOpts = {
  /** 上游开发服务器端口，默认 9527 */
  port?: number
}

const DEFAULT_PORT = 9527

/** `.ws()` 钩子类型未暴露 `data`，但运行时的 `ElysiaWS.data` 就是连接级可变数据对象 */
type WSConnectionState = { client?: WebSocket }
const wsState = (ws: unknown) => (ws as { data: WSConnectionState }).data

/**
 * 开发环境前端代理插件。
 * 将 HTTP 与 WebSocket 请求反向代理到本地 Vite 等前端开发服务器。
 */
export const frontendDevPlugin = (opts?: FrontendDevPluginOpts) => {
  const port = opts?.port ?? DEFAULT_PORT

  // Elysia 2 起 `.ws()` 需要显式注册 WebSocket 能力
  return new Elysia({ name: 'frontend-dev-plugin' })
    .use(websocket())
    .all('/*', async ({ request }) => {
      const url = new URL(request.url)
      const target = `http://localhost:${port}${url.pathname}${url.search}`

      const headers = new Headers(request.headers)
      headers.set('host', `localhost:${port}`)
      headers.delete('origin')
      headers.delete('connection')

      return fetch(target, {
        method: request.method,
        headers,
        body: request.body,
        redirect: 'manual',
      })
    })
    .ws('/*', {
      async open(ws) {
        const url = new URL(ws.request.url)
        url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
        url.port = String(port)
        url.hostname = 'localhost'

        const client = new WebSocket(url.toString())
        client.binaryType = 'arraybuffer'
        wsState(ws).client = client

        client.onmessage = (event) => {
          if (typeof event.data === 'string') {
            ws.send(event.data)
          } else if (event.data instanceof ArrayBuffer) {
            ws.send(new Uint8Array(event.data))
          } else if (event.data instanceof Blob) {
            event.data.arrayBuffer().then((buffer) => ws.send(new Uint8Array(buffer)))
          }
        }

        client.onclose = (event) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close(event.code, event.reason)
          }
        }

        client.onerror = (error) => {
          if (ws.readyState === 1) {
            ws.close(1011, error instanceof Error ? error.message : String(error))
          }
        }
      },
      message(ws, message) {
        const client = wsState(ws).client
        if (!client || client.readyState !== WebSocket.OPEN) {
          return
        }
        client.send(typeof message === 'string' ? message : JSON.stringify(message))
      },
      close(ws, code, reason) {
        const client = wsState(ws).client
        if (client?.readyState === WebSocket.OPEN) {
          client.close(code, reason)
        }
      },
    })
}
