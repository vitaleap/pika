# AGENTS.md - @pika/elysia-plugins

## 定位

`@pika/elysia-plugins` 收集跨 app 复用的 **运行时 Elysia 插件**（HTTP server 中间件），

**与 `@pika/bun-plugins` 的区别**：

| 包                     | 用途                                         | 执行时机 |
| ---------------------- | -------------------------------------------- | -------- |
| `@pika/bun-plugins`    | Bun bundler plugin（改写 JS 源码、注入资源） | 构建时   |
| `@pika/elysia-plugins` | Elysia HTTP 插件（路由、中间件、静态资源）   | 运行时   |

新功能请按性质归入对应包，**不要混用**。

## 技术栈

- **运行时依赖**：`elysia`（与 server app 版本对齐）、`dayjs`（peer，供 utc/timezone 扩展使用）
- Bun 平台 API（`Bun.file`、`Bun.isMainThread` 等）通过 `@types/bun` 提示
- 编译/类型检查使用仓库根目录的 TypeScript 配置

## 项目结构

```ini
src/
  index.ts                       # 统一导出入口（`export * from './<plugin>'`）
  error.ts                       # HttpError + 全局错误处理插件
  global-context.ts             # 全局上下文插件（基于 AsyncLocalStorage，避免 service 层传递 context）
  i18n.ts                        # 请求级语言协商和翻译插件
  jwt.ts                         # JWT 鉴权插件（注册 @elysia/jwt，支持 includePaths/excludePaths 白/黑名单与 prefixPaths）
  jwt-auth.ts                    # 基于 jwt 的鉴权插件（requireRole/requirePermissions 支持 string | string[]，注入 getRoles/getPermissions 判定）
  req-id.ts                      # 请求 ID 与响应耗时插件
  request-ip.ts                  # 请求 IP 提取插件（默认从 x-forwarded-for / x-real-ip 获取）
  static.ts                      # 生产环境前端静态资源 + SPA fallback 插件
  timezone.ts                    # 请求时区插件（Time-Zone 请求头 + dayjs utc/timezone，注入 timeZone/dayjs）
  utils/
    vary.ts                      # Vary 响应头合并工具（包内共用，不经 index 对外导出）
```

## 常用命令

```bash
# 检查 (tsc + prettier)
bun --filter=@pika/elysia-plugins run check

# 格式化
bun --filter=@pika/elysia-plugins run lint
```

## i18n plugin

完整实现与 API 规范查看 `.agents/docs/server/i18n.md`。

## 添加新 plugin 步骤

1. 在 `src/<name>.ts` 中实现 plugin 工厂函数，导出 plugin 与必要的类型
2. 在 `src/index.ts` 中加 `export * from './<name>'`
3. 在目标 app 的 `package.json` 中通过 `"@pika/elysia-plugins": "workspace:*"` 引用
4. 在 `app.ts` 中 `import { <plugin> } from '@pika/elysia-plugins'`，`app.use(<plugin>(...))`
5. 跑 `bun lint` 格式化、`bun check` 确保类型通过

## 设计原则

- **单一职责**：每个 plugin 只解决一类运行时问题（如静态资源、限流、metrics）
- **配置驱动**：可复用行为通过 opts 暴露，可复用部分以 app 专属配置（如 basePath、port）作为入参
- **依赖收敛**：运行时依赖限定为 `elysia`、`dayjs` 等由宿主 app 提供的 `peerDependencies`，以及无法外置的必要依赖（`zod`、`@elysia/jwt`）；本包不依赖任何 `apps/*` 内部模块。`dayjs` 必须走 peer，避免多实例导致 `dayjs.extend` 失效
- **不与构建期 plugin 混淆**：本包的 plugin 是 Elysia HTTP 插件，与 `BunPlugin` 完全不同

## 命名约定

- **文件**: kebab-case（例如：`request-ip.ts`、`jwt-auth.ts`）
- **导出**: camelCase 命名 plugin 工厂 / 类型使用 PascalCase

## 导入 & 模块风格

```typescript
// 包内使用相对路径
import { Elysia } from 'elysia'
import { join, normalize } from 'node:path'

// 类型导入必须使用 `import type`
import type { ElysiaConfig } from 'elysia'

// 运行时依赖（Bun file API）按需引入
const file = Bun.file(path)
```

- 所有对外导出统一在 `src/index.ts` 中汇总，供外部通过 `@pika/elysia-plugins` 包名导入；包内共用工具（如 `utils/vary.ts`）只通过相对路径内部引用，不对外导出
- 不得依赖任何 app 内部模块（`apps/*`），仅依赖 `elysia` 与 node 标准库

## 注意

全程使用中文交流
