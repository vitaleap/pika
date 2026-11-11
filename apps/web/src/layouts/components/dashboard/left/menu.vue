<template>
  <div class="flex flex-col pl-2 gap-4">
    <menu-group
      v-for="menu in currentMenus"
      :key="menu.title"
      :title="menu.title"
      :options="menu.options"
    ></menu-group>
  </div>
</template>
<script setup lang="tsx">
const menuStore = useMenuStore()
const { menus, adminMenus } = storeToRefs(menuStore)
const route = useRoute()
const currentMenus = computed(() => {
  if (route.path.startsWith('/admin')) {
    return adminMenus.value
  }
  return menus.value
})
</script>
