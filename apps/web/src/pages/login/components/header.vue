<template>
  <n-image
    :width="48"
    :height="48"
    preview-disabled
    class="pointer-events-none select-none"
    :src="`/images/logo-${themeStore.isDark ? 'dark' : 'light'}.png`"
  ></n-image>
  <div class="right-8 top-8 absolute flex items-center gap-2">
    <locale-switch></locale-switch>
    <theme-switch></theme-switch>
  </div>
  <n-h1 class="!mb-1 !mt-0">{{ config.projectName }}</n-h1>
</template>
<script setup lang="ts">
const { config } = useConfigStore()
const themeStore = useThemeStore()
</script>
