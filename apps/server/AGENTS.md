# AGENTS.md - Server

## 技术栈

- **框架**: Elysia
- **ORM**: Drizzle ORM
- **数据库**: PostgreSQL 或 PGlite
- **验证**: Zod
- **认证**: @elysia/jwt + `auth` 插件（`@/common/plugins/auth`，校验登录态与角色/权限）
- **API 文档**: @elysia/openapi
- **日志**: pino + pino-pretty
- **缓存**: @seepine/cache
- **ID 生成**: simple-flakeid
- **日期**: dayjs
- **邮件**: nodemailer

## 项目结构

```ini
common/             # 基础设施，与业务模块解耦
  cache.ts          # 缓存薄包装
  config.ts         # 配置（config-type.ts 提供类型）
  db/               # 数据库连接和基础设施
    index.ts        # 数据库连接 (useDb) 和迁移 (runMigrate)
    base/           # 公共列定义 (baseColumns、dayjsType)
    plugins/        # 数据库驱动插件 (pglite 等)
  email.ts          # 邮件
  files.ts          # 文件服务
  hooks/            # 通用钩子（数据库迁移、snowflake 初始化等），在 hooks/index.ts 导入注册
  locales/          # 基础设施字典（auth 鉴权/权限、zod 兜底文案）；业务文案在各模块 locales
  log.ts            # 日志
  plugins/          # 全局插件薄包装（i18n, timezone, auth, global-context），复用 @pika/elysia-plugins
  rate-limit.ts     # 多窗口限流
  snowflake.ts      # ID 生成
  utils/            # 辅助工具（cluster, crypto, embed-assets）
  zod.ts            # Zod 扩展
src/                # 业务模块
  index.ts          # 入口点
  app.ts            # Elysia 顶层装配，挂载各 module 的 app
  system/           # system 模块（prefix: /system），核心业务（用户/认证/配置）
    app.ts          # systemApp Elysia 实例
    __test__/       # 模块内测试
    hooks/          # 模块自己的钩子，app.ts 中 import './hooks' 注册
    locales/        # 模块自包含 i18n（zh, en）
    repositories/   # 数据访问抽象类
    schemas/        # Drizzle schema 定义
    routes/         # 路由（auth/captcha/file/user/admin/config/system）
    services/       # 业务逻辑
    utils/          # 模块内工具（验证码、校验）
  demo/             # demo 模块（prefix: /demo），示例与健康检查
    app.ts          # demoApp Elysia 实例
    __test__/       # 模块内测试
    hooks/          # 模块自己的钩子，app.ts 中 import './hooks' 注册
    locales/        # 模块自包含 i18n（zh, en）
    routes/         # 路由
  [moduleName]/     # 新增模块按统一约定扩充（详见 .agents/docs/server/modules.md）
drizzle/            # 数据库迁移文件
public/             # 静态资源
```

**模块是 server 的核心组织单位**。详细约定与新增步骤查看 modules.md。

## 常用命令

```bash
# 开发
bun run dev              # 启动开发服务器

# 构建（由 @pika/bun-plugins 的 pika-build CLI 提供）
bun run build            # 编译为单文件可执行程序
bun run build --js       # 构建 js 产物

# 测试
bun test                 # 运行所有测试（apps/server 内）
bun run test:server      # 在仓库根目录运行 server 测试

# 代码检查
bun run check            # 使用 Prettier 和 tsc 检查代码格式

# 代码修复
bun run lint             # 使用 Prettier 格式化所有文件

# 数据库
bun run db:gen           # 根据 schema 生成迁移文件
bun run db:kit           # 打开 drizzle-kit 交互命令
```

### 运行时 & 工具

- **仅使用 Bun** - 严禁使用 npm, pnpm, 或 yarn
- Bun 自动加载 `.env` 文件 - 不要使用 dotenv
- 所有系统方法优先使用 Bun 的 API，例如 `Bun.file` 而非 `node:fs`

### 命名约定

- **文件**: kebab-case（例如：`auth.ts`、`error-handler.ts`）
- **类**: PascalCase (例如：`AuthService`, `Users`)
- **变量/函数**: camelCase (例如：`userService`, `handleError`)
- **数据库**: snake_case（通过 `drizzle-orm/pg-core` 的 `snakeCase.table` 定义表与列名）
- **类型/接口**: PascalCase 使用描述性名称
- **常量**: UPPER_SNAKE_CASE 用于真正的常量

### 导入 & 模块风格

导入示例

```typescript
// 外部依赖优先
import { Elysia } from 'elysia'
import { z } from 'zod'

// 内部绝对导入：@/common/* 指向基础设施，@/* 指向 src/ 下的业务模块
import { log } from '@/common/log'
import { AuthService } from '@/system/services/auth'

// 类型导入必须使用 `import type`
import type { JwtPayload } from '@/common/plugins/auth'
```

若导入未使用，则应移除该导入语句。

## modules - 模块

完整模块化规范（目录约定、app.ts/routes 模板、跨模块协作、新增模块步骤）查看 `.agents/docs/server/modules.md`。

## routes - 路由

完整路由规范查看 `.agents/docs/server/routes.md`。

## services - 业务逻辑

完整业务逻辑规范查看 `.agents/docs/server/services.md`。

## i18n - 国际化

完整 Server 国际化规范查看 `.agents/docs/server/i18n.md`。

## timezone - 时区

完整 Server 时区规范查看 `.agents/docs/server/timezone.md`。

## db - 数据库

完整数据库规范查看 `.agents/docs/server/db.md`。

## hooks - 钩子

完整钩子规范查看 `.agents/docs/server/hooks.md`。

## 测试

测试文件与被测代码就近存放，不使用顶层 `test/` 目录。

- **common**：与源文件同名、同目录，如 `common/plugins/i18n.test.ts`、`common/utils/crypto.test.ts`
- **业务模块**：统一放在 `src/<module>/__test__/`，内部按 `routes/`、`services/` 镜像源码目录，如 `src/system/__test__/routes/admin/user.test.ts`
- **场景细分**：同一源文件有多个场景时追加后缀，如 `routes/user-email.test.ts`、`routes/user-check.test.ts`
- **运行**：仓库根 `bun run test:server` 或 `bun test`（apps/server 内）
