# AGENTS.md - Web

## 技术栈

- **框架**: Vue 3 + TypeScript
- **构建工具**: Vite 8
- **UI 组件库**: Naive UI + Naive Plus
- **CSS 方案**: UnoCSS + Sass
- **状态管理**: Pinia 4
- **路由**: Vue Router 5（基于文件的自动路由）
- **请求库**: Alova
- **国际化**: Vue I18n + @intlify/unplugin-vue-i18n
- **其他依赖**: dayjs、es-toolkit

## 项目结构

```ini
src/
├── api/          # 接口相关，通过Alova自动从后端openapi生成，不应修改
├── assets/       # 全局样式
├── components/   # 通用组件
├── composables/  # 可复用的组合式函数
├── layouts/      # 布局组件（default、admin）
├── locales/      # 仅存放跨文件公共文案和必须全局解析的语言资源
├── pages/        # 页面（自动生成根路径路由）
├── router/       # 路由配置与布局绑定
├── stores/       # Pinia 状态模块（user、menu、theme）
├── utils/        # 工具函数
├── App.vue       # 根组件
├── main.ts       # 入口文件
└── env.d.ts      # 环境类型声明
```

## 常用命令

```bash
bun dev              # 启动开发服务器
bun run check        # 检查
bun run lint         # 修复
bun run build        # 构建
```

## 路由规则

- `src/pages/` 下的 `.vue` 文件自动生成根路径路由（如 `/login`）。
- `src/views/` 下的 `.vue` 文件自动生成带 `views/` 前缀的路由（如 `/views/dashboard`）。
- `**/components/*` 目录下的文件会被排除，不会生成路由。

## 代码规范

- 未使用变量以 `_` 开头可豁免（如 `_unused`）。
- Vue 组件允许单词命名（如 `index.vue`）。
- 路径别名：`@` 指向 `src/`。

## 编码约定

- Vue 组件使用 `<script setup lang="ts">` + Composition API。
- 自动导入已启用：`vue`、`pinia`、`vue-router`（含 `useRouter`、`useRoute` 等）的常用 API 无需手动 import。
- 状态模块在 `src/stores/` 下，按功能拆分子目录。
- 接口相关代码在 `src/api/`，由 openapi-generator vite 插件自动生成。

## 国际化

- i18n 规范：[`../../.agents/docs/web/i18n.md`](../../.agents/docs/web/i18n.md)。
- 页面或组件专用文案使用局部 `<i18n lang="yaml">`。
- TS、TSX、hook 或 store 专用文案在原文件内使用 `isolated` messages。
- `src/locales/*.json` 只存放跨文件公共文案和必须全局解析的内容。

## 组件使用

- Naive UI 组件已通过 `unplugin-vue-components` 自动注册，直接使用即可。
- 优先使用 NaivePlus 组件：例如对于按钮、表单等场景，优先使用 `np-button`、`np-form` 等组件以提升开发效率
