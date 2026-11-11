<template>
  <component :is="render"></component>
</template>

<script setup lang="tsx">
export type MenuOption = { label: string; url: string; icon?: VNode }
const props = withDefaults(
  defineProps<{
    title?: string
    theme?: 'default' | 'simple'
    options: MenuOption[]
  }>(),
  {
    theme: 'default',
  },
)
const route = useRoute()

const render = () => {
  const titleRender = () => {
    if (!props.title) {
      return undefined
    }
    return <span class="menu-title">{props.title}</span>
  }
  return (
    <div class={`menu-group menu-theme-${props.theme}`}>
      {titleRender()}
      <div class="menu-options">
        {props.options.map((item) => {
          const isActive = route.path === item.url
          return (
            <RouterLink to={item.url} class={`menu-item menu-item-${isActive ? 'active' : ''}`}>
              {item.icon}
              <span>{item.label}</span>
            </RouterLink>
          )
        })}
      </div>
    </div>
  )
}
</script>
<style lang="scss">
.menu-group {
  @apply flex flex-col;

  .menu-title {
    @apply text-size-xs color-text-2 mb-2;
    @apply whitespace-nowrap text-ellipsis;
  }
  .menu-options {
    @apply flex flex-col gap-1;
  }
  .menu-item {
    @apply flex flex-row items-center gap-2 py-1;
    @apply cursor-default color-text-2 hover:color-text-2;
    @apply whitespace-nowrap text-ellipsis;
    i {
      @apply flex-shrink-0;
    }
    &-active {
      @apply color-text-1!;
    }
  }
}

.menu-theme-default {
  .menu-title {
    @apply px-3;
  }
  .menu-item {
    @apply px-2 rounded py-1.5;
    @apply hover:bg-[var(--color-hover)];
    &-active {
      @apply bg-[var(--color-hover)]!;
    }
    .n-icon {
      width: 1.2em;
      height: 1.2em;
    }
  }
}
</style>
