<template>
  <div class="h-full flex-1 flex flex-col">
    <div class="pl-2">
      <div class="h-[50px] flex flex-row items-center pr-2">
        <router-link to="/dashboard" class="py-2 w-full flex flex-row items-center px-2 gap-2">
          <n-image
            :width="24"
            :height="24"
            preview-disabled
            class="pointer-events-none select-none"
            :src="`/images/logo-${themeStore.isDark ? 'dark' : 'light'}.png`"
          ></n-image>
          <div>{{ config.projectName }}</div>
        </router-link>

        <w-icon-button v-if="systemInfo.md" @click="handleCollapsed">
          <n-icon class="i-fluent-panel-left-32-filled" role="img" aria-hidden="true"></n-icon>
        </w-icon-button>
      </div>
      <n-divider class="mt-0! mb-2!"></n-divider>
    </div>
    <div class="flex-1 overflow-y-auto">
      <left-menu></left-menu>
    </div>
    <div class="p-2">
      <left-user></left-user>
    </div>
  </div>
</template>
<script setup lang="tsx">
import { throttle } from 'es-toolkit'
import LeftMenu from './menu.vue'
import LeftUser from './user.vue'
import { systemInfo } from '@/composables/system'

const themeStore = useThemeStore()
const { config } = useConfigStore()

const collapsed = inject('c-layout-collapsed', ref(false))
const handleCollapsed = throttle(
  () => {
    collapsed.value = !collapsed.value
  },
  250,
  { edges: ['leading'] },
)
</script>
