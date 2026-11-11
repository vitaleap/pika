<template>
  <div class="setting-language">
    <n-card content-class="py-2!">
      <np-cell-group bordered :options="options"></np-cell-group>
    </n-card>
  </div>
</template>
<script setup lang="tsx">
import type { NpCellGroupOption } from 'naive-plus'
import { useI18n } from 'vue-i18n'
import { i18nTitle } from '@/utils/i18n-title'
import type { LanguageMode } from '@/stores/preference'

definePage({
  meta: {
    title: i18nTitle('pageTitle.language'),
  },
})

const { t } = useI18n()
const preferenceStore = usePreferenceStore()

const languageOptions = computed(() => [
  { label: t('followSystem'), key: 'system' },
  { label: t('chinese'), key: 'zh' },
  { label: t('english'), key: 'en' },
])

const timeZoneOptions = computed(() => {
  const zones = Intl.supportedValuesOf?.('timeZone') ?? []
  return [
    { label: t('followSystem'), key: 'system' },
    ...zones.map((zone) => ({ label: zone, key: zone })),
  ]
})

const options = computed<NpCellGroupOption[]>(() => [
  {
    label: t('language'),
    value: () => (
      <WPicker
        placeholder={t('language')}
        options={languageOptions.value}
        value={preferenceStore.language}
        showArrow={true}
        placement="bottom-end"
        onChange={(value: LanguageMode) => preferenceStore.setLanguage(value)}
      />
    ),
  },
  {
    label: t('timezone'),
    value: () => (
      <WPicker
        placeholder={t('timezone')}
        options={timeZoneOptions.value}
        value={preferenceStore.timezone}
        showArrow={true}
        placement="bottom-end"
        onChange={(value: string) => preferenceStore.setTimezone(value)}
      />
    ),
  },
])
</script>

<i18n lang="yaml">
zh:
  language: 语言
  timezone: 时区
  followSystem: 自动
  chinese: 中文
  english: English
en:
  language: Language
  timezone: Time zone
  followSystem: Auto
  chinese: 中文
  english: English
</i18n>
