# AGENTS.md - @pika/shared

本文件为 AI Coding 在 `packages/shared/` 中工作时提供指导。

## 定位

`@pika/shared` 是前后端共用的共享模块，存放跨运行时（Node / Bun / 浏览器）通用的工具函数与校验逻辑。

## 技术栈

- **纯 TypeScript**，无任何运行时依赖
- 编译/类型检查使用仓库根目录的 TypeScript 配置

## 项目结构

```ini
src/
  index.ts     # 统一导出入口
  appearance.ts # 外观风格共享常量 (BACKGROUND_TYPES, MAIN_BG_BLUR_MAX)
  strings.ts   # 字符串工具 (Strings)
  validate.ts  # 通用校验 (isNickname, isPassword, isEmail, validateEmail)
```

## 常用命令

```bash
# 检查 (tsc + prettier)
bun --filter=@pika/shared run check

# 格式化
bun --filter=@pika/shared run lint
```

## 核心约束

- **必须保持跨运行时兼容**：模块可能同时运行于 Bun（server）、浏览器（web），**禁止**使用以下平台特有 API：
  - Node 特有：`node:*` 内置模块（如 `node:crypto`、`node:fs`）
  - Bun 特有：`Bun.*` API（如 `Bun.password`）
  - DOM 特有：`window`、`document` 等
- 仅可使用标准 ECMAScript 与 Web 标准 API（如 `globalThis.crypto`）
- 若某工具依赖特定运行时（如 `Bun.password`、`node:cluster`），**不要**放入 shared，应保留在各 app 内部

## 命名约定

- **文件**: kebab-case（例如：`strings.ts`、`validate.ts`）
- **类**: PascalCase（例如：`Strings`）
- **变量/函数**: camelCase（例如：`isNickname`）
- **常量**: UPPER_SNAKE_CASE（例如：`VALIDATE_EMAIL`）

## 导入 & 模块风格

```typescript
// shared 内部引用其他文件时，使用相对路径
import { isEmail } from './validate'

// shared 禁止导入任何外部依赖与 app 内部模块
```

- 类型导入必须使用 `import type`
- 所有导出统一在 `src/index.ts` 中汇总，供外部通过 `@pika/shared` 包名导入

## 添加新工具步骤

1. 创建 `src/<name>.ts` 文件，保持跨运行时兼容
2. 在 `src/index.ts` 中导出（`export * from './<name>'`）
3. 提供完整的中文注释（用途、参数、返回值）
4. 在 `apps/server` 或 `apps/web` 中按需引用验证
5. 运行 `bun lint` 格式化，`bun check` 确保类型通过

## 注意

全程使用中文交流
