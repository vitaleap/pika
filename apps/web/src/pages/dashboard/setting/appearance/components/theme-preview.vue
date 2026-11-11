<template>
  <div class="theme-preview">
    <button
      v-for="item in items"
      :key="item.value"
      type="button"
      class="theme-preview__item"
      :class="{ 'is-active': item.value === modelValue }"
      @click="emit('select', item.value)"
    >
      <span class="theme-preview__thumb" :class="`is-${item.value}`">
        <span class="theme-preview__sidebar">
          <span class="theme-preview__dots">
            <i></i>
            <i></i>
            <i></i>
          </span>
        </span>
        <span class="theme-preview__bar"></span>
      </span>
      <span class="theme-preview__label">{{ item.label }}</span>
    </button>
  </div>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{ modelValue: ThemeMode }>()

const emit = defineEmits<{ select: [value: ThemeMode] }>()

const { t } = useI18n()

const items = computed<{ value: ThemeMode; label: string }[]>(() => [
  { value: 'system', label: t('automatic') },
  { value: 'light', label: t('light') },
  { value: 'dark', label: t('dark') },
])
</script>
<style lang="scss" scoped>
.theme-preview {
  @apply flex flex-row gap-2;

  &__item {
    @apply flex flex-col items-center gap-1 rounded-lg bg-transparent p-1 cursor-pointer;
    border: 2px solid transparent;
    transition: border-color 0.15s;

    &.is-active {
      border-color: var(--n-primary-color);
    }
  }

  &__thumb {
    @apply relative block overflow-hidden;
    width: 64px;
    height: 40px;
    border-radius: 4px;
    background: linear-gradient(140deg, #a8c6f7 0%, #6f92ea 45%, #364a9c 100%);
    box-shadow: 0 0 0 1px rgb(0 0 0 / 10%);

    &.is-dark {
      background: linear-gradient(140deg, #2b3b74 0%, #1a2350 50%, #0c1027 100%);
    }

    &.is-system {
      background: linear-gradient(90deg, #a8c6f7 0 50%, #1a2350 50% 100%);
    }
  }

  &__sidebar {
    @apply absolute bottom-0 left-0 top-0 flex items-end p-1;
    width: 42%;
    background: rgb(255 255 255 / 78%);
  }

  &__dots {
    @apply flex flex-row gap-[2px];

    i {
      @apply block rounded-full;
      width: 3px;
      height: 3px;

      &:nth-child(1) {
        background: #ff5f57;
      }

      &:nth-child(2) {
        background: #febc2e;
      }

      &:nth-child(3) {
        background: #28c840;
      }
    }
  }

  &__bar {
    @apply absolute rounded-full;
    top: 8px;
    left: 50%;
    right: 7px;
    height: 5px;
    background: rgb(255 255 255 / 55%);
  }

  &__thumb.is-dark &__sidebar {
    background: rgb(0 0 0 / 45%);
  }

  &__thumb.is-dark &__bar {
    background: rgb(255 255 255 / 18%);
  }

  &__thumb.is-system &__sidebar {
    background: linear-gradient(90deg, rgb(255 255 255 / 78%) 0 50%, rgb(0 0 0 / 45%) 50% 100%);
  }

  &__label {
    @apply text-xs color-text-2;
  }

  &__item.is-active &__label {
    @apply color-text-1;
  }
}
</style>

<i18n lang="yaml">
zh:
  automatic: 自动
  light: 浅色
  dark: 深色
en:
  automatic: Auto
  light: Light
  dark: Dark
</i18n>
