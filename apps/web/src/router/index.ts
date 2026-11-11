import { createRouter, createWebHistory } from 'vue-router'
import { routes as autoRoutes } from 'vue-router/auto-routes'
import { pinia } from '@/stores'
import { setupLayouts } from './layout'
import { i18n } from '@/utils/i18n'
import { resolveTitle } from '@/utils/i18n-title'
import { watch } from 'vue'

const routes = setupLayouts(autoRoutes)

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

declare module 'vue-router' {
  /**
   * @example
   * ```ts
   * definePage({
   *   title: '页面标题',
   *   meta: {
   *     authRequired: false,
   *   },
   * })
   * ```
   */
  interface RouteMeta {
    /**
     * 布局组件名称，例如 /src/layouts/empty.vue，则为 empty
     * 注意：只对根页面有效，在子页面声明不会生效
     *   例如 /src/pages/xxx.vue
     *   或者 /src/pages/xxx/index.vue
     *
     * 也会根据路径匹配，例如存在 layouts/admin.vue
     * 则 pages/admin/xxx.vue 下都会默认使用该路由
     *
     *
     * @default default
     */
    layout?: 'empty' | 'dashboard' | 'liquid-glass'
    /**
     * 标题
     */
    title?: string
    /**
     * 是否保持路由 alive
     * @default false
     */
    keepAlive?: boolean
    /**
     * 隐藏 dashboard 布局顶部 header（用于全屏内容页）
     * @default false
     */
    hideHeader?: boolean
    /**
     * 是否需要登录才能访问
     * @default true
     */
    authRequired?: boolean
  }
}

const userStore = useUserStore(pinia)
const { config } = useConfigStore(pinia)

const setDocumentTitle = (titleKey?: string) => {
  const title = resolveTitle(titleKey)
  document.title = title ? `${title} - ${config.projectName}` : config.projectName
}

// 匹配管理员命名空间根路径 `/admin` 及其子路径
const isAdminPath = (path: string) => path === '/admin' || path.startsWith('/admin/')

router.beforeEach((to) => {
  setDocumentTitle(to.meta.title)
  if (to.path === '/account/reg' && !config.auth.regEnabled) {
    return '/404'
  }
  // 先处理未登录，保证匿名用户能带着 redirect 进入登录页
  if (!userStore.isLogin && to.meta.authRequired !== false) {
    return {
      path: '/login',
      query: to.fullPath === '/' ? undefined : { redirect: to.fullPath },
    }
  }
  // 已登录后再校验管理员角色
  if (isAdminPath(to.path) && !userStore.user.roles?.includes('admin')) {
    return '/404'
  }
})

watch(i18n.global.locale, () => {
  setDocumentTitle(router.currentRoute.value.meta.title)
})

/**
 * 是否存在「站内」上一页
 *
 * vue-router 每次导航都会把上一条路由的地址写入 `window.history.state.back`：
 * - 首次进入站点（浏览器新标签页直接打开、刷新、或首个导航是 replace）时 `back` 为 null
 * - 站内跳转后 `back` 为字符串
 *
 * 注意：不能用 `window.history.length > 1` 判断，它包含了进入本站之前的历史记录
 */
export const hasBackRoute = () => typeof window.history.state?.back === 'string'

export default router
