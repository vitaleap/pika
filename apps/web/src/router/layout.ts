import { type RouteRecordRaw, RouterView } from 'vue-router'

const layoutsPage = import.meta.glob<VNode>(['../layouts/*.vue'])
const newLayouts: {
  [key: string]: () => Promise<VNode>
} = {}
Object.keys(layoutsPage).forEach((key) => {
  const layoutName = key.split('/').pop()?.split('.')[0]
  if (layoutName && layoutsPage[key]) {
    newLayouts[layoutName] = layoutsPage[key]
  }
})
if (!newLayouts['default']) {
  newLayouts['default'] = async () => h(RouterView)
}

const resetRoute = (route: RouteRecordRaw): RouteRecordRaw[] => {
  if (typeof route.name === 'string') {
    // 页面文件名即路由名，末尾的 `/` 表示更深层级需要去掉，但 `/` 本身要保留
    const path =
      route.name.endsWith('/') && route.name.length > 1
        ? route.name.substring(0, route.name.length - 1)
        : route.name
    return [{ ...route, path }]
  }
  return route.children?.flatMap((child) => resetRoute(child)) ?? []
}
const getPathPrefix = (path: string): string => {
  if (!path.includes('/')) {
    return path
  }
  const arr = path.split('/')
  if (arr.length === 0) {
    return path
  }
  return arr[0]!
}
// 过滤掉 meta.hide 为 true 的路由，子路由一并移除
const filterHiddenRoutes = (routes: readonly RouteRecordRaw[]): RouteRecordRaw[] =>
  routes
    .filter((route) => !route.meta?.hide)
    .map((route) => {
      if (!route.children) {
        return route
      }
      return { ...route, children: filterHiddenRoutes(route.children) }
    })

export const setupLayouts = (routes: readonly RouteRecordRaw[]): readonly RouteRecordRaw[] => {
  const visibleRoutes = filterHiddenRoutes(routes)
  // 处理路由，例如 pages/[dir]/index.vue，首节点为路径空路由，因此需要拼接
  // `/` 页面单独拎出来挂载，解决 layout 不生效的问题
  const homeRoute = visibleRoutes.find((route) => route.path === '/')
  const newRoutes = visibleRoutes.flatMap((route) => (route.path === '/' ? [] : resetRoute(route)))

  const layoutKeys = Object.keys(newLayouts)
  const layoutRoutes: RouteRecordRaw[] = [
    {
      name: 'home_route',
      path: '/',
      component: newLayouts[homeRoute?.meta?.layout || 'default'],
      children: homeRoute ? [homeRoute] : [],
    },
    {
      name: 'layout_default',
      path: '/',
      component: newLayouts['default'],
      children: newRoutes.filter(
        // 未设置layout，且前缀未属于任何一个layout，则归到default
        (r) => r.meta?.layout === undefined && !layoutKeys.includes(getPathPrefix(r.path)),
      ),
    },
    ...Object.keys(newLayouts)
      .filter((layout) => layout !== 'default')
      .map((layoutName) => {
        return {
          name: `layout_${layoutName}`,
          path: '/',
          component: newLayouts[layoutName],
          children: newRoutes.filter((r) => {
            // 路由指定
            if (r.meta?.layout === layoutName) {
              return true
            }
            // 或者路径匹配
            return r.meta?.layout === undefined && r.path.startsWith(`/${layoutName}`)
          }),
        }
      }),
  ]

  return [
    ...layoutRoutes.filter((item) => (item.children ?? []).length > 0),
    { path: '/:pathMatch(.*)*', component: () => import('@/pages/404.vue') },
  ]
}
