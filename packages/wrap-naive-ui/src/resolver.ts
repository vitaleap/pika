import type { ComponentResolver } from 'unplugin-vue-components'

/**
 * `unplugin-vue-components` 的 resolver。
 *
 * 在 vite / webpack 等构建工具中注册后，可直接以 `<WAvatar />` 或 `<w-avatar />`
 * 的形式使用本包组件，无需手动 import。
 *
 * 匹配规则：PascalCase（`WAvatar`）或 kebab-case（`w-avatar`）且以 `W` / `w-`
 * 开头。**新增 `w-*` 组件时无需修改此处**，所有以 `w-` 开头的组件都会被自动解析。
 *
 * ```ts
 * // vite.config.ts
 * import { WrapNaiveUiResolver } from '@pika/wrap-naive-ui/resolver'
 *
 * Components({
 *   resolvers: [WrapNaiveUiResolver()],
 * })
 * ```
 */
export function WrapNaiveUiResolver(): ComponentResolver {
  return {
    type: 'component',
    resolve: (name: string) => {
      if (/^W[A-Z]/.test(name) || name.startsWith('w-')) {
        return {
          name,
          from: '@pika/wrap-naive-ui',
        }
      }
    },
  }
}
