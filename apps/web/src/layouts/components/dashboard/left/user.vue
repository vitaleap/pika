<template>
  <div>
    <n-divider class="mt-0! mb-2!"></n-divider>
    <user-dropdown>
      <np-cell
        style="--np-cell-left-gap: 0px; --np-cell-padding-x: 8px; --np-cell-padding-y: 4px"
        :label="userStore.user.name || ''"
        :description="descriptionRender"
        :icon="avatarRender"
        :value="valueRender"
        hover
      ></np-cell>
    </user-dropdown>
  </div>
</template>
<script setup lang="tsx">
const userStore = useUserStore()

const avatarRender = () => <img class="w-7! h-7! rounded-full" src={userStore.user.picture} />
const valueRender = () => <NIcon class="i-ph-caret-up-down text-size-sm"></NIcon>
const descriptionRender = () => (
  <span class="line-clamp-1">{userStore.user.email || userStore.user.phone_number}</span>
)
</script>
