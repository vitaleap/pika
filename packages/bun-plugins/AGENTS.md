# AGENTS.md - @pika/bun-plugins

本文件为 AI Coding 在 `packages/bun-plugins/` 中工作时提供指导。

## 定位

`@pika/bun-plugins` 收集团队在 `bun build` 流程中复用的 Bun bundler plugin，并提供 server 构建 CLI（`pika-build`），**仅用于构建时**，不参与 server / web 运行时代码。

## 技术栈

- **Bun bundler plugin** (`BunPlugin`)，依赖 `@types/bun`
- **CLI 参数解析**使用 `commander`
- 编译/类型检查使用仓库根目录的 TypeScript 配置

## 项目结构

```ini
src/
  index.ts                       # 统一导出入口（`export * from './<plugin>'`）
  assets-plugin.ts               # 资源拷贝 / 内嵌（js 产物拷入 dist，编译产物内嵌二进制）
  canvaskit-embed-plugin.ts      # 内嵌 canvaskit-wasm，产物无需外部 wasm 文件
  cli/
    build.ts                     # 构建 CLI（`bin: pika-build`）
```

## 常用命令

```bash
# 检查 (tsc + prettier)
bun --filter=@pika/bun-plugins run check

# 格式化
bun --filter=@pika/bun-plugins run lint
```

## 构建 CLI

`src/cli/build.ts` 通过 `bin` 暴露为 `pika-build`，在目标 app 目录（cwd）执行：

```bash
pika-build                                             # 编译为单文件可执行程序
pika-build --js                                        # 构建 js 产物
pika-build --target=bun-linux-x64 --name=pika --embed-web  # 交叉编译并内嵌 web 产物
```

- 约定：入口 `src/index.ts`、输出 `dist`、资源 `public` + `drizzle`、web 产物 `../web/dist`
- app 侧声明 `"@pika/bun-plugins": "workspace:*"` 后，scripts 中直接调用 `pika-build`

## 添加新 plugin 步骤

1. 在 `src/<name>.ts` 中实现 `BunPlugin`，导出 plugin / 辅助函数
2. 在 `src/index.ts` 中加 `export * from './<name>'`
3. 在目标 app 的 `package.json` 中通过 `"@pika/bun-plugins": "workspace:*"` 引用
4. 在对应 `build.ts` 中 `import { <plugin> } from '@pika/bun-plugins'`，加入 `plugins: [<plugin>]`
5. 跑 `bun lint` 格式化、`bun check` 确保类型通过

## 设计原则

- **模式无关**：plugin 改写 JS 源码的策略应同时适用于 `--compile` 和 `--js` 两种产物形态，
  不要在 plugin 内部分辨构建模式；判断逻辑应留在调用方
- **单一职责**：每个 plugin 只解决一个具体的打包期问题（如 wasm 内嵌、asset 优化等）

## 命名约定

- **文件**: kebab-case（例如：`canvaskit-embed-plugin.ts`）
- **导出**: camelCase 命名 plugin / 工具函数

## 导入 & 模块风格

```typescript
// 包内使用相对路径
import type { BunPlugin } from 'bun'
import { readFile } from 'node:fs/promises'

// 类型导入必须使用 `import type`
```

- 所有导出统一在 `src/index.ts` 中汇总，供外部通过 `@pika/bun-plugins` 包名导入
- 不得依赖任何 app 内部模块（`apps/*`），仅依赖 node 标准库、`commander` 与 `@types/bun`

## 注意

全程使用中文交流
