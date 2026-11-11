<template>
  <div class="w-layout h-full w-full">
    <w-split
      default-size="250px"
      min-size="180px"
      max-size="340px"
      :collapsed="!systemInfo.md || collapsed"
      collapse-pane="1"
      resize-trigger-class="py-4"
    >
      <template #1>
        <div class="h-full bg-[var(--color-bg-2)]">
          <slot name="menu"></slot>
        </div>
      </template>
      <template #2>
        <div
          class="dashboard-content-area h-full py-2 pr-2"
          :class="!systemInfo.md || collapsed ? 'pl-2' : ''"
        >
          <div
            class="dashboard-content-body h-full flex flex-col"
            :class="hideHeader ? '' : 'overflow-hidden'"
          >
            <template v-if="hideHeader">
              <router-view v-slot="{ Component, route: viewRoute }">
                <keep-alive :max="5">
                  <component
                    :is="Component"
                    v-if="viewRoute.meta.keepAlive"
                    :key="calcKeepAliveKey(viewRoute)"
                  />
                </keep-alive>
                <component :is="Component" v-if="!viewRoute.meta.keepAlive" />
              </router-view>
            </template>
            <template v-else>
              <c-layout-header></c-layout-header>
              <n-scrollbar class="flex-1">
                <router-view v-slot="{ Component, route: viewRoute }">
                  <keep-alive :max="5">
                    <component
                      :is="Component"
                      v-if="viewRoute.meta.keepAlive"
                      :key="calcKeepAliveKey(viewRoute)"
                    />
                  </keep-alive>
                  <component :is="Component" v-if="!viewRoute.meta.keepAlive" />
                </router-view>
              </n-scrollbar>
            </template>
          </div>
        </div>
      </template>
    </w-split>

    <n-drawer
      v-if="!systemInfo.md"
      style="--n-body-padding: 0; min-width: 220px"
      :show="drawerShow"
      width="auto"
      :auto-focus="false"
      placement="left"
      content-class="h-full bg-[var(--color-bg-2)] pr-2"
      @update:show="handleDrawerShowUpdate"
    >
      <slot name="menu"></slot>
    </n-drawer>
  </div>
</template>

<script setup lang="ts">
import { useRoute, type RouteLocationNormalizedLoaded } from 'vue-router'
import { systemInfo } from '@/composables/system.ts'

const route = useRoute()
const hideHeader = computed(() => route.meta.hideHeader === true)
const collapsed = ref(!systemInfo.value.md)
provide('c-layout-collapsed', collapsed)

/**
 * keep-alive 的 key 只取「本层路由记录」：布局壳是 matched 中第一个带 components 的记录，本层即第二个。
 * 直接用 viewRoute.path 会混入子路由参数，导致嵌套子路由切换时父实例重建，侧栏开合与滚动位置丢失。
 */
const calcKeepAliveKey = (viewRoute: RouteLocationNormalizedLoaded): string => {
  const record = viewRoute.matched.filter((item) => item.components)[1]
  if (!record) {
    return viewRoute.path
  }
  const params = (record.path.match(/:[A-Za-z0-9_]+/g) ?? []).map((token) => {
    const value = (viewRoute.params as Record<string, unknown>)[token.slice(1)]
    return `${token}=${value ?? ''}`
  })
  return [record.path, ...params].join('|')
}

const drawerShow = ref(false)

const handleDrawerShowUpdate = (show: boolean) => {
  if (!show) {
    collapsed.value = true
  }
}

watch(
  () => systemInfo.value.md,
  (isDesktop) => {
    collapsed.value = !isDesktop
  },
)

watch(collapsed, (value) => {
  if (!systemInfo.value.md) {
    drawerShow.value = !value
  }
})
</script>

<style scoped lang="scss">
.dashboard-content-area {
  background-color: var(--color-bg-2);
  // 与 w-split 伸缩动画同步
  transition: padding var(--transition-duration) var(--transition-type);

  .dashboard-content-body {
    background-color: var(--color-bg-1);
    border-radius: 8px;
  }
}
</style>
