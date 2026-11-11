# 模块化规范

Server 按 **业务模块** 拆分，每个模块自包含路由、服务、数据访问与字典。模块之间互不直接耦合，通过 services 接口协作。

## 目录约定

```ini
src/                # 业务模块根目录（与 common/ 基础设施目录平级）
  [moduleName]/
    app.ts          # 导出 <moduleName>App Elysia 实例，定义 URL prefix
    hooks/          # 模块自己的钩子，在 hooks/index.ts 导入注册，并在模块 app.ts 中 import './hooks'
      index.ts
    routes/         # 子领域路由，每个文件导出一个 Router
      index.ts      # 聚合所有 router，导出 routes 数组
    services/       # 业务逻辑，抽象类 + 静态方法
    schemas/        # Drizzle schema 定义
    repositories/   # 数据访问抽象类，与 schemas 一一对应
    locales/        # 模块自包含 i18n 字典，并注册到 server/common/plugins/i18n.ts 的 messages 中
      index.ts
      zh.ts
      en.ts
    __test__/       # 模块测试，按 routes/ services/ 镜像源码目录
```

- `[moduleName]` 使用小写单词（如 `system`、`demo`、`payment`），与 `prefix` 保持一致。
- 模块位于 `src/` 下，基础设施位于 `common/` 下，二者平级；`@/common/*` 指向基础设施，`@/*` 指向 `src/`。
- `routes/`、`services/` 是必备目录；其余目录按需创建。
- 模块是相对独立的单元。模块间通过 services 接口互相调用，**不直接跨模块访问 repositories / schemas**。

## app.ts 模板

```ts
import { Elysia } from 'elysia'
import { routes } from './routes'
import './hooks'

export const systemApp = new Elysia({
  prefix: '/system', // 与 moduleName 保持一致
}).use(routes)
```

`prefix` 与目录名一致，最终 URL 会形如 `/api/system/...`（`/api` 是顶层 mount 固定路径，来自 `config.basePath`）。

## routes/index.ts 模板

```ts
import type { AnyElysia } from 'elysia'
import { authRouter } from './auth'
import { userRouter } from './user'

const defineRoutes = <const Routes extends AnyElysia[]>(routes: Routes) => routes

export const routes = defineRoutes([authRouter, userRouter])
```

- 每个路由文件导出 `<name>Router`（如 `authRouter`、`userRouter`）。
- 路由文件本身可设置自己的 `prefix`（如 `authRouter` 用 `prefix: '/oauth'`），与模块级 `prefix` 拼接。
- 新增 router 后必须在此处注册，否则不会挂载到模块的 `app` 上。

## 在顶层装配

`src/app.ts` 通过 `.use()` 把模块 app 挂载到 api ：

```ts
import { systemApp } from '@/system/app'
import { demoApp } from '@/demo/app'

export const api = new Elysia().use(systemApp).use(demoApp)
```

## 跨模块协作

- **跨模块调用**通过对方的 services 接口实现；每个模块的 repositories / schemas 仅供本模块内部访问。
- 共享通用工具（日志、snowflake、邮件、文件）通过 `@/common/*` 或 `@pika/elysia-common`。
- 共享通用中间件（auth 鉴权与角色/权限、错误处理、限流、静态资源）通过 `@pika/elysia-plugins`。
- 模块业务文案写在 `src/[moduleName]/locales/{zh,en}.ts`；`common/locales/` 只供 common 基础设施使用。
- 业务代码从 `@/common/plugins/i18n` 导入全局 `t`，使用 `t('MODULE.KEY')` 形式；新增模块时在 `common/plugins/i18n.ts` 注册数据源。

## 测试

- 测试统一放在 `<moduleName>/__test__/`，不放到仓库顶层 `test/`，也不与源码混放。
- `__test__/` 内部按源码目录镜像组织：

  ```ini
  __test__/
    routes/
      auth.test.ts
      admin/
        config.test.ts
        user.test.ts
    services/
      user.test.ts
  ```

- 测试文件与被测源文件同名；同一源文件有多个场景时追加后缀，如 `routes/user-email.test.ts`。
- 路由测试通过 `startApp()` 启动完整应用，用 `@elysia/eden` 的 `treaty` 发起请求；每个测试文件使用独立端口，避免并发冲突。
- 测试数据必须自行清理（创建的用户、缓存、配置等），避免污染共享测试数据库。

## 新增模块步骤

1. 在 `src/` 下创建目录，命名遵循小写单词（如 `payment`）。
2. 创建 `<moduleName>/app.ts`，导出 `<moduleName>App` 实例并设置 `prefix`。
3. 创建 `<moduleName>/routes/` 子目录，编写路由文件并在 `routes/index.ts` 中聚合。
4. 在 `src/app.ts` 中 `.use(<moduleName>App)` 挂载到 api 实例。
5. **如涉及启动/关闭钩子**：在 `<moduleName>/hooks/` 下实现并在 `<moduleName>/hooks/index.ts` 导入，再由模块 `<moduleName>/app.ts` 的 `import './hooks'` 注册（详见 `.agents/docs/server/hooks.md`）。
6. **如涉及数据库**：
   - 在 `<moduleName>/schemas/` 定义 Drizzle schema
   - 在 `<moduleName>/repositories/` 定义 Repository（CRUD 静态方法）
   - `drizzle.config.ts` 的 `schema` 字段已配置为 glob `'./src/*/schemas'`，会自动包含新模块
7. **如涉及业务文案**：在 `<moduleName>/locales/{zh,en}.ts` 中添加 key，并在 `common/plugins/i18n.ts` 的 `messages` 中追加 `MODULE_NAME: <moduleName>Locales` 即可被全局 `t` 自动识别（详见 `.agents/docs/server/i18n.md`）。
8. 在 `<moduleName>/__test__/` 下编写模块测试用例，并跑 `bun lint`、`bun check`、`bun test`。
