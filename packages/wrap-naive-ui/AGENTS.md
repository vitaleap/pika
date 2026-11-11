# AGENTS.md - @pika/wrap-naive-ui

## 定位

`@pika/wrap-naive-ui` 是对 [naive-ui](https://www.naiveui.com/) 的二次封装集合，统一业务侧的默认行为（地址前缀、字号、背景色派生等），并通过 `w-config-provider` 提供全局默认值能力。

## 技术栈

- **运行时依赖**：`vue`、`naive-ui`、`es-toolkit`
- **构建/类型**：`vue-tsc`（基于 `@seepine/vue-tsc`）+ `@vue/tsconfig`
- 类型直接以 `.ts` / `.vue` 形式发布（依赖消费方的 bundler 处理）

## 项目结构

```ini
src/
  index.ts                                 # 统一导出入口
  config-provider.ts                      # WComponentOptions 类型 + 注入 key
  components/
    w-config-provider/index.vue           # 全局组件默认配置
    w-avatar/index.vue                    # 头像（封装 n-avatar）
    w-avatar-upload/index.vue             # 头像上传（w-avatar + w-upload）
    w-icon-button/index.vue               # 图标按钮（封装 n-button）
    w-picker/index.vue                    # chip 下拉选择器（封装 n-dropdown）
    w-radio-block/index.vue               # 分段单选块（封装 n-tabs）
    w-split/index.vue                     # 分割面板（封装 n-split）
    w-upload/index.vue                    # 文件上传（封装 n-upload）
```

## 常用命令

```bash
# 检查（vue-tsc + prettier）
bun --filter=@pika/wrap-naive-ui run check

# 格式化
bun --filter=@pika/wrap-naive-ui run lint
```

## 设计原则

- **命名规范**：所有组件以 `w-` 前缀，对应 Vue 组件名为 `W<ComponentName>`（如 `w-avatar` -> `WAvatar`）
- **依赖收敛**：仅依赖 `vue`、`naive-ui`、`es-toolkit`，**不要** import 任何 app 内部模块
- **环境无关**：避免硬编码任何业务专属的 `baseURL` / 路径，必要时通过 prop 注入
- **可配置默认**：组件本地默认值可在 `w-config-provider` 的 `component-options` 中被覆盖，组件 prop 优先级最高

## 优先级链

```
组件 prop  >  w-config-provider 的 component-options[<ComponentName>]  >  组件本地默认值
```

## 命名约定

- **文件 / 目录**：kebab-case（如 `w-avatar/index.vue`）
- **导出**：PascalCase（`WAvatar`、`WConfigProvider`）
- **类型**：PascalCase（`WComponentOptions`）

## 导入 & 模块风格

```typescript
// 包内使用相对路径

// 类型导入必须使用 `import type`
import type { WComponentOptions } from './config-provider'
```

- 所有导出统一在 `src/index.ts` 中汇总，供外部通过 `@pika/wrap-naive-ui` 包名导入
- 包内类型/常量请尽量就近放在组件同目录；跨组件复用的类型/常量放在 `src/` 顶层（如 `config-provider.ts`）

## 注意

全程使用中文交流
