<template>
  <div class="h-full flex flex-col">
    <div class="pl-2 pt-2">
      <div class="h-[54px] flex flex-row items-center pr-4">
        <router-link to="/" class="py-2 w-full flex flex-row items-center px-2 gap-2">
          <n-image
            :width="24"
            :height="24"
            preview-disabled
            class="pointer-events-none select-none"
            :src="`/images/logo-${themeStore.isDark ? 'dark' : 'light'}.png`"
          ></n-image>
          <div>{{ config.projectName }}</div>
        </router-link>
      </div>
      <n-divider class="mt-0! mb-2!"></n-divider>
    </div>
    <div class="flex-1">
      <left-menu></left-menu>
    </div>
    <div class="p-2">
      <left-user></left-user>
    </div>
  </div>
</template>
<script setup lang="tsx">
import LeftMenu from './menu.vue'
import LeftUser from './user.vue'

const themeStore = useThemeStore()
const { config } = useConfigStore()
</script>
