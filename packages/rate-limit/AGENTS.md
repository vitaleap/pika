# AGENTS.md - @pika/rate-limit

## 定位

`@pika/rate-limit` 提供与 web 框架无关的多窗口限流 helper：

- `rateLimit(cache, opts, key)`：多窗口（second/minute/minute10/hour/day）一次性检查，超限抛 `RateLimitError`
- `getRateLimitTimes(cache, key, seconds)`：单窗口查询，由调用方决定是否超限

**与 `@pika/elysia-plugins` 的区别**：

| 包                     | 用途                         | 是否依赖 web 框架 |
| ---------------------- | ---------------------------- | ----------------- |
| `@pika/elysia-plugins` | HTTP 中间件（请求/响应处理） | 是（elysia）      |
| `@pika/rate-limit`     | 通用限流 helper              | 否                |

`@pika/rate-limit` 抛 `RateLimitError`（带 `status` 字段），由调用方转换为对应框架的错误类。Server 端在 `@/common/rate-limit.ts` 将其转换为 `HttpError`。

## 技术栈

- **运行时依赖**：无（仅依赖调用方传入的 cache 实例）
- 跨运行时：兼容 Node 18+ / Bun
- 编译/类型检查使用仓库根目录的 TypeScript 配置

## 项目结构

```ini
src/
  index.ts                       # 统一导出入口（`export * from './rate-limit'`）
  rate-limit.ts                  # rateLimit / getRateLimitTimes / RateLimitError
```

## 常用命令

```bash
# 检查 (tsc + prettier)
bun --filter=@pika/rate-limit run check

# 格式化
bun --filter=@pika/rate-limit run lint
```

## 设计原则

- **框架无关**：不 import 任何 web 框架（elysia / express / koa 等），可在任意 Node/Bun 项目中复用
- **错误中立**：抛 `RateLimitError` 而非 `HttpError`，由调用方转换为目标框架的错误类型
- **配置驱动**：窗口配置通过 opts 暴露，**不要硬编码业务专属配置**（如 message）
- **依赖收敛**：仅依赖调用方传入的 `RateLimitCache`，结构化类型 `{ get<T>, set<T> }` 兼容 `@seepine/cache` 等

## 命名约定

- **文件**: kebab-case（例如：`rate-limit.ts`）
- **导出**: camelCase（helper）+ PascalCase（类型/错误类）

## 导入 & 模块风格

```typescript
// 包内使用相对路径

// 类型导入必须使用 `import type`
import type { RateLimitCache, RateLimitOptions } from './rate-limit'
```

- 所有导出统一在 `src/index.ts` 中汇总，供外部通过 `@pika/rate-limit` 包名导入
- 不得依赖任何 app 内部模块（`apps/*`），不得依赖 web 框架

## 注意

全程使用中文交流
