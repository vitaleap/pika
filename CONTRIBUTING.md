# 贡献指南

简体中文 | [English](./CONTRIBUTING.en.md)

感谢你愿意参与 Pika。本文档说明本地开发、提交规范与检查流程。

## 环境要求

- [Bun](https://bun.com) 1.4+

## 本地开发

```bash
# 安装依赖
bun install

# 同时启动 server 与 web
bun run dev
```

- Web：http://localhost:9527
- Server：http://localhost:9528
- OpenAPI 文档：http://localhost:9528/api/openapi

本地默认使用 PGlite，数据落在 `.tmp/`，无需额外安装数据库。需要自定义配置时，将 `apps/server/.env.example` 复制为 `apps/server/.env.local` 后修改。

## 提交前检查

```bash
bun run lint    # Prettier 格式化
bun run check   # 类型检查
bun run test    # 测试
```

以上命令需全部通过。CI 会在 Pull Request 上执行同样的检查。

## 提交规范

提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/)，由 commitlint 在 `commit-msg` 钩子中校验：

```ini
feat: 新功能
fix: 修复缺陷
docs: 文档变更
refactor: 重构（不改变行为）
test: 测试相关
chore: 构建、依赖等杂项
```

`pre-commit` 钩子会对暂存文件执行 lint-staged，请勿使用 `--no-verify` 跳过。

## Pull Request

1. 从 `main` 拉出新分支，分支名建议 `feat/xxx`、`fix/xxx`
2. 保持改动聚焦，一个 PR 只解决一个问题
3. 在 PR 描述中说明背景、改动点与验证方式
4. 涉及行为变更时，补充或更新对应测试

## 代码约定

- 全程使用 TypeScript，避免 `any`
- 提交前请阅读对应目录的规范：`apps/server/AGENTS.md`、`apps/web/AGENTS.md`、`packages/AGENTS.md`
- 可复用能力沉淀到 `packages/*`，业务代码只做薄封装
- 注释、文档可任选中英文
- 提交信息必须使用英文

## 安全问题

请勿通过公开 Issue 报告安全漏洞，参见 [SECURITY.md](./SECURITY.md)。
