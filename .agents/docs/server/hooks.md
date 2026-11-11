# Hooks 规范

## Hooks 位置

Hooks 按归属分为两层，与模块一样自包含：

```ini
common/hooks/             # 通用与基础设施钩子（数据库迁移、snowflake 初始化等）
  index.ts
  init-common.ts
  db.ts
src/
  [moduleName]/
    hooks/                # 模块自己的钩子
      index.ts            # 注册入口
      init-db-data.ts
    app.ts                # 模块入口，统一 import 同级 hook 文件
```

- 通用能力（数据库、缓存、ID 生成等）的钩子放 `common/hooks/`。
- 只服务于某个业务模块的钩子放 `src/[moduleName]/hooks/`，随模块一起挂载。
- 新增 hook 文件后，必须在同级 `index.ts` 中 `import`，否则不会注册。

## 注册入口

| 归属                      | 注册文件                          | 由谁导入                                    |
| ------------------------- | --------------------------------- | ------------------------------------------- |
| `common/hooks/`           | `common/hooks/index.ts`           | `src/app.ts` 中的 `import '@/common/hooks'` |
| `src/[moduleName]/hooks/` | `src/[moduleName]/hooks/index.ts` | 模块 `app.ts` 中的 `import './hooks'`       |

模块钩子不需要在 `src/app.ts` 中重复导入：模块 `app.ts` 被顶层 `.use()` 挂载时会一并执行。

## 钩子类型

| 钩子               | 说明   | 执行时机                            |
| ------------------ | ------ | ----------------------------------- |
| `onStartBefore`    | 启动前 | 应用启动前，Elysia 实例注册路由之前 |
| `onStart`          | 启动时 | 应用启动时，Elysia 实例已注册路由   |
| `onShutdownBefore` | 关闭前 | 应用关闭前                          |
| `onShutdown`       | 关闭后 | 应用关闭后                          |

## 使用示例

```typescript
import { HookOrder, onShutdown, onStart } from '@pika/elysia-hook'

onStart(async () => {
  // 启动时执行，例如连接数据库
}, HookOrder.Early)

onShutdown(async () => {
  // 关闭后执行，例如断开数据库连接
})
```

## 执行顺序

- 每个钩子队列按 `order` 升序执行，值越小越先执行；`sort` 省略时使用 `HookOrder.Default`
- 相同 `order` 按注册顺序执行

### 使用 HookOrder 预设

`@pika/elysia-hook` 导出 `HookOrder` 预设，**直接使用预设，不要手写数字**：

| 预设                | 值     | 用途                       |
| ------------------- | ------ | -------------------------- |
| `HookOrder.First`   | -10000 | 无外部依赖的基础设施初始化 |
| `HookOrder.Early`   | -5000  | 数据库连接与迁移等基础依赖 |
| `HookOrder.Default` | 0      | 业务模块自身的钩子（默认） |
| `HookOrder.Late`    | 5000   | 业务钩子之后的收尾逻辑     |
| `HookOrder.Last`    | 10000  | 最后执行                   |

> 上表仅用于理解层级关系，实际取值以 `packages/elysia-hook/src/lifecycle.ts` 的 `HookOrder` 为准。

对应本项目的分层：

- `common/hooks/` 用 `First` / `Early`，确保先于模块钩子
- `src/[moduleName]/hooks/` 用 `Default`，可依赖已完成的基础设施
- 同一模块内需要细分时，用 `Late` 或自定义整数

> `sort` 只接受整数，传入非整数（如 `Number.MIN_VALUE`）会抛 `TypeError`。
> 注意 `Number.MIN_VALUE` 是最小**正数**（`5e-324`）而不是最小数，且 `Number.MIN_VALUE + 1 === 1`。

## 新增钩子步骤

1. 在 `common/hooks/` 或 `src/[moduleName]/hooks/` 下新建 kebab-case 文件，例如 `init-db-data.ts`。
2. 在文件中调用 `onStartBefore` / `onStart` / `onShutdownBefore` / `onShutdown` 注册逻辑，需要控制先后时传入 `HookOrder` 预设。
3. 在同级 `index.ts` 中 `import './<文件名>'`。
