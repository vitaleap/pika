# 路由规范

## 路由定义

- 所有接口都按 **模块** 组织，定义在 `src/[moduleName]/routes/` 目录下，每个文件对应一个路由；例如 `src/system/routes/auth.ts`、`src/demo/routes/v1.ts`。
- 路由文件应导出一个 Elysia 实例，包含所有相关路由。
- 模块内所有路由在 `src/[moduleName]/routes/index.ts` 中聚合；新增路由在此处注册后才会在模块的 `app` 上生效。
- 模块的 URL 前缀（如 `/system`、`/demo`）由 `src/[moduleName]/app.ts` 的 `prefix` 字段控制；路由文件本身的 `prefix` 仍按子路径设置（如 `authRouter` 使用 `prefix: '/oauth'`）。

参考示例

```ts
// 导出变量命名：[文件名]Router，如 authRouter、userRouter
export const userRouter = new Elysia({
  // 路由前缀，与文件名保持一致
  prefix: '/user',
  detail: {
    // 路由标签，用于 OpenAPI 文档，如无特殊需求，也应与文件名保持一致
    tags: ['user'],
    // 路由安全配置，如无特殊需求，每个接口都应配置 HTTP Bearer 认证
    security: [{ 'HTTP Bearer': [] }],
  },
})
```

## 鉴权

- 路由统一使用 `auth` 插件（`@/common/plugins/auth`）完成 token 校验与角色判断。
- 按需用 `excludePaths`（黑名单）、`includePaths`（白名单）、`basePath` 声明鉴权范围。
- `role` / `permissions` 均支持 `string | string[]`，传数组时需全部满足；不传则只校验登录态。
- 角色由服务端按当前用户实时判定，校验失败返回 403。

参考示例

```ts
// 仅校验登录态
.use(auth())
// 放行免鉴权接口
.use(auth({ excludePaths: ['/config', '/health'] }))
// 需要 admin 角色
.use(auth({ role: 'admin' }))
// 权限体系待接入（见上文说明），当前声明 permissions 会直接 403
.use(auth({ role: ['admin', 'auditor'], permissions: ['user:read', 'user:write'] }))
```

## 路由接口定义

- 接口定义应在 Elysia 实例链式调用 `new Elysia().get().post()`，而不是另起新行 `router.get()/router.post()`。
- 接口业务逻辑调用服务类方法，路由处理函数只负责调用与响应包装。
- 入参一般只会有一种，例如 GET 一般为 `query` (查询参数) 或 `params` (路径参数如 `/user/:id`)，POST 一般为 `body`
- 每个路由接口都应包含 `detail` 配置，包括 `operationId` 和 `summary`。
  - `operationId` 用于 OpenAPI 文档，应唯一标识该接口。
  - `tags` 无需在接口级别配置，由 router 级别的 `detail.tags` 自动继承。
- 每个接口按需添加 `body`、`params`、`query` 和 `response` 配置 (均与 `detail` 同级)：
  - `body` 应包含 Zod schema，用于验证请求体数据。
  - `params` 应包含 Zod schema，用于验证路径参数。
  - `query` 应包含 Zod schema，用于验证查询参数。
  - `response` 应包含 Zod schema，用于验证响应数据。
- 所有的 Zod schema 都应该定义在对应 Service 类中，命名一般为 `[Path][Type]Schema`，例如
  - body: `EditBodySchema`
  - response: `EditRespSchema`
  - params: `EditParamsSchema`
  - query: `EditQuerySchema`

参考示例

```ts
// 正确用法
export const userRouter = new Elysia({
  prefix: '/user',
  detail: {
    tags: ['user'],
    security: [{ 'HTTP Bearer': [] }],
  },
}).post(
  '/edit',
  {
    detail: {
      operationId: 'edit',
      summary: 'Edit user profile',
    },
    // body, params, query, response 均与 detail 同级
    body: UserService.EditBodySchema,
    response: UserService.EditRespSchema,
  },
  async ({ body, user }) => {
    return await UserService.edit(user.sub, body)
  },
)

// 错误用法
// export const userRoute = new Elysia()
// userRouter.post()
// userRouter.get()
```
