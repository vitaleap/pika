# AGENTS.md - @pika/elysia-openapi

## 定位

`@pika/elysia-openapi` 提供基于 `@elysia/openapi` + Scalar 的 Elysia OpenAPI 文档插件。

**与 `@pika/elysia-plugins` 的区别**：

| 包                     | 用途                                | 关键依赖                             |
| ---------------------- | ----------------------------------- | ------------------------------------ |
| `@pika/elysia-plugins` | 通用 HTTP 中间件（i18n、req-id 等） | 仅 `elysia`                          |
| `@pika/elysia-openapi` | OpenAPI + Scalar 文档生成           | `elysia` + `@elysia/openapi` + `zod` |

不引入文档生成的项目可以继续只依赖 `@pika/elysia-plugins`，避免 `@elysia/openapi` 与 `zod` 的传递性依赖。

## 技术栈

- **运行时依赖**：`elysia`、`@elysia/openapi`、`zod`
- Bun 平台 API 通过 `@types/bun` 提示
- 编译/类型检查使用仓库根目录的 TypeScript 配置

## 项目结构

```ini
src/
  index.ts                       # 统一导出入口（`export * from './openapi'`）
  openapi.ts                     # openapiPlugin 与相关 opts 类型
```

## 常用命令

```bash
# 检查 (tsc + prettier)
bun --filter=@pika/elysia-openapi run check

# 格式化
bun --filter=@pika/elysia-openapi run lint
```

## 设计原则

- **单一职责**：仅提供 OpenAPI 文档生成插件，不混入其它中间件
- **依赖收敛**：仅依赖 `elysia` / `@elysia/openapi` / `zod`，不引入其它 server 业务模块
- **配置驱动**：所有 UI / Scalar 选项通过 opts 暴露，**不要硬编码业务专属配置**（如 title、version）

## 命名约定

- **文件**: kebab-case（例如：`openapi.ts`）
- **导出**: camelCase 命名 plugin 工厂；类型使用 PascalCase

## 导入 & 模块风格

```typescript
// 包内使用相对路径
import { openapi } from '@elysia/openapi'
import * as z from 'zod'

// 类型导入必须使用 `import type`
```

- 所有导出统一在 `src/index.ts` 中汇总，供外部通过 `@pika/elysia-openapi` 包名导入
- 不得依赖任何 app 内部模块（`apps/*`）

## 注意

全程使用中文交流
