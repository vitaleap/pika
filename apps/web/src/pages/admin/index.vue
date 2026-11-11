<template>
  <div>{{ t('title') }}</div>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<i18n lang="yaml">
zh:
  title: 首页
en:
  title: Home
</i18n>
