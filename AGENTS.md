# AGENTS.md

本文件为 AI Coding 在本仓库中工作时提供指导。

## 基础

### 项目结构

```ini
.agents/
  docs              # 项目相关文档
  skills            # 项目级技能
apps
  server/           # 服务端项目, Elysia + Drizzle + PostgreSQL
  web/              # 网页端项目, Vite + Vue3 + Naive-UI + UnoCSS
packages
  shared/           # 前后端共享模块 (@pika/shared)
  bun-plugins/      # 构建时 Bun bundler plugin 集合与构建 CLI (@pika/bun-plugins)
  elysia-common/    # Elysia server 通用基础设施：日志/ID/邮件/文件 (@pika/elysia-common)
  elysia-plugins/   # 运行时 Elysia 通用 HTTP 中间件集合 (@pika/elysia-plugins)
  elysia-openapi/   # OpenAPI 文档生成插件 (@pika/elysia-openapi)
  elysia-hook/      # 应用生命周期管理（启动/关闭钩子）(@pika/elysia-hook)
  rate-limit/       # 多窗口限流 helper (@pika/rate-limit)
  wrap-naive-ui/    # naive-ui 二次封装 (@pika/wrap-naive-ui)
docker/             # dockerfile 相关文件
```

### 常用命令

```bash
# 开发
bun run dev
# 代码格式化
bun run lint
# 代码检查
bun run check
# 构建
bun run build
# 测试
bun run test
# 生成数据库迁移
bun run db:gen
# 打开 drizzle-kit 交互命令
bun run db:kit
```

### 文档

- bun: https://bun.com/llms.txt
- elysia: https://elysiajs.com/llms.txt
- vue: https://cn.vuejs.org/llms.txt
- naivePlus: https://naiveplus.seepine.com/llms.txt
- esToolkit: https://es-toolkit.dev/llms.txt

## server

完整 server 规范查看 `./apps/server/AGENTS.md`

## web

完整 web 规范查看 `./apps/web/AGENTS.md`

## packages

完整 packages 规范查看 `./packages/AGENTS.md`

## 测试

按需进行以下几种测试

- 后端：必要时，需要编写测试用例
- 前端：使用 `ego-lite`/`chrome-devtools` 等技能进行真实操作验证

## 注意

全程使用中文交流

- 开始前

使用 `.agents/skills/karpathy-guidelines` skill

- 完成后，按照以下步骤进行：
  1. 使用 `.agents/skills/code-simplifier/SKILL.md` 对代码进行简化。
  2. 使用 `bun run lint` 对代码进行格式化，确保符合项目的代码规范。
  3. 使用 `bun run check` 对代码进行检查，确保符合项目的类型规范。
  4. 使用 `bun run test` 执行测试用例，确保所有测试都通过。
