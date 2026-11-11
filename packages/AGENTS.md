# AGENTS.md - Packages

本文件为 AI Coding 在 `packages/` 目录中工作时提供指导。

## 基础

### 项目结构

```ini
packages/
  shared/           # 前后端共享模块，见 ./shared/AGENTS.md
  bun-plugins/      # 构建时 Bun bundler plugin 集合与构建 CLI，见 ./bun-plugins/AGENTS.md
  elysia-common/    # Elysia server 通用基础设施（日志/ID/邮件/文件），见 ./elysia-common/AGENTS.md
  elysia-plugins/   # 运行时 Elysia 通用 HTTP 中间件集合，见 ./elysia-plugins/AGENTS.md
  elysia-openapi/   # OpenAPI 文档生成插件，见 ./elysia-openapi/AGENTS.md
  elysia-hook/      # 应用生命周期管理（启动/关闭钩子），见 ./elysia-hook/AGENTS.md
  rate-limit/       # 多窗口限流 helper，见 ./rate-limit/AGENTS.md
  wrap-naive-ui/    # naive-ui 二次封装，见 ./wrap-naive-ui/AGENTS.md
```

### 包命名

- 统一使用 `@pika/*` 前缀，例如 `@pika/shared`
- 包名使用 kebab-case（如 `shared`、`utils`、`types`）

### 包规范

- 每个包必须有独立的 `package.json`（含 `name`、`exports` 字段）和 `tsconfig.json`
- 通过 `"workspace:*"` 在 `apps/*/package.json` 中声明依赖，**不要**手写相对路径导入
- 包内的 `src/index.ts` 作为统一导出入口
- 每个包应提供 `check`（tsc + prettier）和 `lint`（prettier --write）脚本，并在根 `package.json` 中注册 `check:<pkg>` / `lint:<pkg>`

### 新增包步骤

1. 在 `packages/` 下创建目录，命名遵循上述规范
2. 创建 `package.json`、`tsconfig.json`、`src/index.ts`
3. 在需要使用的 `apps/*/package.json` 中通过 `"workspace:*"` 添加依赖
4. 在根 `package.json` 的 `workspaces`（已含 `packages/*`）、`check` / `lint` 脚本中注册
5. 更新根 `AGENTS.md` 与 `packages/AGENTS.md` 的项目结构说明
