# AGENTS.md - @pika/elysia-hook

## 定位

`@pika/elysia-hook` 提供 Elysia 应用生命周期管理：

- `onStartBefore` / `onStart` / `onShutdownBefore` / `onShutdown`：注册启动 / 关闭钩子
- `HookOrder`：钩子执行顺序预设（`First` / `Early` / `Default` / `Late` / `Last`），避免手写数字
- `triggerOnStartBefore` / `triggerOnStart` / `triggerOnShutdownBefore` / `triggerOnShutdown`：触发钩子队列
- `gracefulShutdown`：监听 SIGTERM / SIGINT，幂等注册

**与 `@pika/elysia-plugins` 的区别**：

| 包                     | 用途                          | 是否依赖 Elysia |
| ---------------------- | ----------------------------- | --------------- |
| `@pika/elysia-plugins` | HTTP 中间件（请求/响应处理）  | 是              |
| `@pika/elysia-hook`    | 应用生命周期（启动/关闭钩子） | 否              |

`@pika/elysia-hook` 不依赖 Elysia，可被任何 Node / Bun 服务复用（Express、Hono、Fastify 等）。

## 技术栈

- **运行时依赖**：无（仅依赖 `node:process` 内置）
- 跨运行时：兼容 Node 18+ / Bun
- 编译/类型检查使用仓库根目录的 TypeScript 配置

## 项目结构

```ini
src/
  index.ts                       # 统一导出入口（`export * from './lifecycle'`）
  lifecycle.ts                   # 启动/关闭钩子队列 + graceful shutdown
```

## 常用命令

```bash
# 检查 (tsc + prettier)
bun --filter=@pika/elysia-hook run check

# 格式化
bun --filter=@pika/elysia-hook run lint
```

## 设计原则

- **单一职责**：仅提供应用生命周期工具，不混入 HTTP 中间件、Elysia 路由等
- **状态单例**：hook 队列、shutdown 监听器在模块作用域内单例，重复注册安全
- **跨框架**：不依赖任何 web 框架，可独立使用

## 命名约定

- **文件**: kebab-case（例如：`lifecycle.ts`）
- **导出**: camelCase

## 导入 & 模块风格

```typescript
// 包内使用相对路径
import { onStart } from './lifecycle'

// 类型导入必须使用 `import type`
```

- 所有导出统一在 `src/index.ts` 中汇总，供外部通过 `@pika/elysia-hook` 包名导入
- 不得依赖任何 app 内部模块（`apps/*`），仅依赖 Node/Bun 标准 API

## 注意

全程使用中文交流
