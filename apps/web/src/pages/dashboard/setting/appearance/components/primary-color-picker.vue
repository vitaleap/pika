<template>
  <div class="primary-color-picker">
    <button
      v-for="item in items"
      :key="item.value"
      type="button"
      class="primary-color-picker__item"
      :class="{ 'is-active': item.value === modelValue }"
      @click="emit('select', item.value)"
    >
      <span class="primary-color-picker__dot" :style="{ backgroundColor: item.color }"></span>
    </button>
  </div>
</template>
<script setup lang="ts">
defineProps<{ modelValue: PrimaryColor }>()

const emit = defineEmits<{ select: [value: PrimaryColor] }>()

const themeStore = useThemeStore()

/** 预设顺序即声明顺序，色点取当前模式下的主色 */
const items = computed(() => {
  const mode = themeStore.isDark ? 'dark' : 'light'
  return (Object.keys(primaryColorPresets) as PrimaryColor[]).map((value) => ({
    value,
    color: primaryColorPresets[value][mode].color,
  }))
})
</script>
<style lang="scss" scoped>
.primary-color-picker {
  @apply flex flex-row flex-wrap gap-1;

  &__item {
    @apply flex flex-col items-center gap-1 rounded-lg bg-transparent p-1 cursor-pointer;
    border: 2px solid transparent;
    transition: border-color 0.15s;

    &.is-active {
      border-color: var(--n-primary-color);
    }
  }

  &__dot {
    @apply block rounded-full;
    width: 22px;
    height: 22px;
    box-shadow: inset 0 0 0 1px rgb(0 0 0 / 8%);
  }
}
</style>
