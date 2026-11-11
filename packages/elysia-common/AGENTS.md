# AGENTS.md - @pika/elysia-common

## 定位

`@pika/elysia-common` 汇集 Elysia server 启动所需的**通用基础设施**，供多个 server 子模块复用：

- `createLogger`：pino + pino-pretty 日志实例工厂
- `createSnowflake`：雪花 ID 生成器工厂（支持 workerId 抢占）
- `sendMail`：基于 nodemailer 的邮件发送纯函数
- `createFilesService`：基于 files-sdk 的文件上传/下载服务工厂

**与其他包的区别**：

| 包                     | 用途                              |
| ---------------------- | --------------------------------- |
| `@pika/elysia-plugins` | HTTP 中间件（请求/响应）          |
| `@pika/elysia-hook`    | 应用生命周期（启动/关闭）         |
| `@pika/elysia-openapi` | OpenAPI 文档生成                  |
| `@pika/elysia-common`  | 通用基础设施（日志/ID/邮件/文件） |

## 技术栈

- **运行时依赖**：`pino`、`pino-pretty`、`simple-flakeid`、`nodemailer`、`files-sdk`
- 跨运行时：兼容 Bun（使用 `Bun.env` 读取环境变量）
- **不依赖 Elysia**：logger / snowflake / email / files 全部框架中立，可被任意 Node / Bun 服务复用

## 项目结构

```ini
src/
  index.ts            # 统一导出入口（`export * from './<module>'`）
  logger.ts           # createLogger
  snowflake.ts        # createSnowflake
  email.ts            # sendMail
  files.ts            # createFilesService
  utils/
    path.ts   # resolvePath
```

## 常用命令

```bash
# 检查 (tsc + prettier)
bun --filter=@pika/elysia-common run check

# 测试
bun --cwd=packages/elysia-common test

# 格式化
bun --filter=@pika/elysia-common run lint
```

## 设计原则

### 1. 依赖注入优先（不得耦合 app）

所有跨包依赖通过**参数注入**（工厂模式）或**结构化类型**传入：

| 模块                 | 注入内容                                          |
| -------------------- | ------------------------------------------------- |
| `createLogger`       | `{ level, mode, filePath? }`                      |
| `createSnowflake`    | `{ cache, onShutdown, env?, log? }`               |
| `sendMail`           | `(mailConfig, { to, subject, text, tip? }, log?)` |
| `createFilesService` | `{ getFileConfig, t, ErrorClass, filePath }`      |

### 2. 框架中立

不 import 任何 web 框架（elysia / express / koa 等），可在任意 Node / Bun 项目中复用。

### 3. 错误中立

包内不抛特定框架的异常（如 `HttpError`）；调用方通过 `ErrorClass` 注入目标框架的错误类。

## 命名约定

- **文件**: kebab-case（例如：`snowflake.ts`、`files.ts`）
- **导出**:
  - 工厂函数使用 camelCase（如 `createLogger`、`createSnowflake`、`createFilesService`）
  - 纯函数使用 camelCase（如 `sendMail`）
  - 类型 / 接口使用 PascalCase（如 `SnowflakeDeps`、`MailConfig`）

## 导入 & 模块风格

```typescript
// 包内使用相对路径
import { pino } from 'pino'
import { PinoPretty } from 'pino-pretty'

// 类型导入必须使用 import type
import type { SnowflakeDeps } from './snowflake'
```

- 所有导出统一在 `src/index.ts` 中汇总，供外部通过 `@pika/elysia-common` 包名导入
- 不得依赖任何 app 内部模块（`apps/*`），仅依赖第三方库与 Bun 标准 API

## 添加新模块步骤

1. 在 `src/<name>.ts` 中实现工厂/纯函数，所有外部依赖通过参数注入
2. 在 `src/index.ts` 中加 `export * from './<name>'`
3. 在 `package.json` 添加该模块需要的运行时依赖
4. 在调用方 `apps/*/package.json` 通过 `"@pika/elysia-common": "workspace:*"` 引用
5. 跑 `bun lint` 格式化、`bun check` 确保类型通过

## 注意

全程使用中文交流
