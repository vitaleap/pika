<template>
  <np-form :option="option" />
</template>
<script setup lang="tsx">
import { useOption } from './password'

const emit = defineEmits<{
  (event: 'ok'): void
}>()

const { option } = useOption(() => {
  emit('ok')
})
</script>
