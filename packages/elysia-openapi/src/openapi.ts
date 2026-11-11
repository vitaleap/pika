import { openapi } from '@elysia/openapi'
import * as z from 'zod'

export type OpenapiPluginInfoOpts = {
  title?: string
  version?: string
  description?: string
}

export type OpenapiPluginServer = {
  url: string
  description?: string
}

export type OpenapiPluginScalarOpts = {
  /** Scalar 版本，决定 cdn 默认地址。@default '1.55.3' */
  version?: string
  /** 自定义 Scalar bundle 地址 */
  cdn?: string
  /** Scalar 主题。@default 'default' */
  theme?: string
  /** 是否隐藏客户端按钮。@default true */
  hideClientButton?: boolean
  /** 是否展开所有响应。@default true */
  expandAllResponses?: boolean
  /** 是否默认展开所有 tag。@default true */
  defaultOpenAllTags?: boolean
  /** 是否显示开发者工具。@default 'never' */
  showDeveloperTools?: 'always' | 'never' | 'auto'
  /** 是否持久化鉴权信息。@default true */
  persistAuth?: boolean
  /** 是否禁用 Scalar Agent 实验性功能。@default true */
  disableAgent?: boolean
  /** 是否禁用 Scalar MCP 实验性功能。@default true */
  disableMcp?: boolean
}

export type OpenapiPluginOpts = {
  /** API 路径前缀。@default '' */
  basePath?: string
  /** 是否开启文档生成。@default true */
  enabled?: boolean
  /** 文档基本信息 */
  info?: OpenapiPluginInfoOpts
  /** 文档 servers 列表；缺省时由 basePath 自动生成 */
  servers?: OpenapiPluginServer[]
  /** Scalar UI 配置 */
  scalar?: OpenapiPluginScalarOpts
}

const SCALAR_CDN_BASE = 'https://unpkg.com/@scalar/api-reference'
const DEFAULT_SCALAR_VERSION = '1.55.3'
const DEFAULT_OPENAPI_VERSION = '0.1.0'
const DEFAULT_OPENAPI_TITLE = 'Pika OpenAPI'

/**
 * OpenAPI + Scalar 文档插件。
 *
 * - 默认开启 zod → JSON Schema 映射（`io: 'input'`），与 Elysia 路由的入参校验保持一致
 * - 默认注入 `HTTP Bearer` (JWT) securityScheme，便于前端 `eden` / `openapi-generator` 直接使用
 */
export const openapiPlugin = (opts?: OpenapiPluginOpts) => {
  const basePath = opts?.basePath ?? ''
  const enabled = opts?.enabled ?? true
  const scalar = opts?.scalar
  const scalarVersion = scalar?.version ?? DEFAULT_SCALAR_VERSION
  const scalarCdn = scalar?.cdn ?? `${SCALAR_CDN_BASE}@${scalarVersion}/dist/browser/standalone.js`

  return openapi({
    enabled,
    documentation: {
      info: {
        title: opts?.info?.title ?? DEFAULT_OPENAPI_TITLE,
        version: opts?.info?.version ?? DEFAULT_OPENAPI_VERSION,
        description: opts?.info?.description ?? '',
      },
      servers: opts?.servers ?? (basePath ? [{ url: basePath }] : undefined),
      components: {
        securitySchemes: {
          'HTTP Bearer': {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
    scalar: {
      version: scalarVersion,
      hideClientButton: scalar?.hideClientButton ?? true,
      expandAllResponses: scalar?.expandAllResponses ?? true,
      defaultOpenAllTags: scalar?.defaultOpenAllTags ?? true,
      showDeveloperTools: scalar?.showDeveloperTools ?? 'never',
      operationTitleSource: 'path',
      persistAuth: scalar?.persistAuth ?? true,
      agent: {
        disabled: scalar?.disableAgent ?? true,
      },
      mcp: {
        disabled: scalar?.disableMcp ?? true,
      },
      theme: scalar?.theme ?? 'default',
      url: `${basePath}/openapi/json`,
      cdn: scalarCdn,
    },
    mapJsonSchema: {
      zod: (schema: z.ZodType, opts: any) => {
        return z.toJSONSchema(schema, { ...opts, io: 'input' })
      },
    },
  })
}
