<template>
  <n-popselect
    :value="preferenceStore.language"
    :options="options"
    trigger="click"
    placement="bottom-end"
    @update:value="handleSelect"
  >
    <n-button
      circle
      type="tertiary"
      :bordered="false"
      size="small"
      :aria-label="t('common.language')"
    >
      <template #icon>
        <n-icon>
          <span class="i-mdi-translate"></span>
        </n-icon>
      </template>
    </n-button>
  </n-popselect>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { isAppLocale } from '@/utils/i18n'

const { t } = useI18n()
const preferenceStore = usePreferenceStore()

const options = computed(() => [
  { label: t('common.automatic'), value: 'system' },
  { label: t('common.chinese'), value: 'zh' },
  { label: t('common.english'), value: 'en' },
])

const handleSelect = (value: string | number | null) => {
  if (value === 'system' || (typeof value === 'string' && isAppLocale(value))) {
    preferenceStore.setLanguage(value)
  }
}
</script>
