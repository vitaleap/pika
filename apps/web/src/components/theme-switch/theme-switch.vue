<template>
  <n-popselect
    :value="themeStore.themeMode"
    :options="options"
    trigger="click"
    @update:value="themeStore.setTheme"
  >
    <n-button circle type="tertiary" :bordered="false" size="small">
      <template #icon>
        <n-icon>
          <span class="i-mdi-theme-light-dark" v-if="themeStore.themeMode === 'system'"></span>
          <span class="i-ph-sun" v-else-if="themeStore.themeMode === 'light'"></span>
          <span class="i-ph-moon" v-else-if="themeStore.themeMode === 'dark'"></span>
        </n-icon>
      </template>
    </n-button>
  </n-popselect>
</template>
<script setup lang="ts">
import { NIcon } from 'naive-ui'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const options = computed(() => [
  { label: t('common.automatic'), value: 'system' },
  { label: t('common.light'), value: 'light' },
  { label: t('common.dark'), value: 'dark' },
])

const themeStore = useThemeStore()
</script>
