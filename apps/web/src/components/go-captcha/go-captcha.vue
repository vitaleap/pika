<template>
  <n-modal v-model:show="show" :trap-focus="false">
    <div class="go-captcha-wrapper">
      <Slide ref="captchaRef" :events="events" :data="slideData" />
      <div
        class="flex flex-col h-full w-full items-center left-0 top-0 justify-center absolute -z-1"
        :class="{
          'z-3': showSuccess || showFailed,
        }"
      >
        <DotLottieVue
          v-if="showSuccess"
          class="lottie"
          :speed="3"
          autoplay
          src="/lottie/success.lottie"
        />
        <DotLottieVue
          v-if="showFailed"
          class="lottie"
          autoplay
          :speed="3"
          src="/lottie/failed.lottie"
        />
      </div>
    </div>
  </n-modal>
</template>
<script setup lang="tsx">
import type { SlideData, SlidePoint } from 'go-captcha-vue/dist/components/slide/meta/data.js'
import { Slide } from 'go-captcha-vue'
import 'go-captcha-vue/dist/style.css'
import { DotLottieVue } from '@lottiefiles/dotlottie-vue'

const emit = defineEmits<{
  (event: 'success', uniqueId: string): void
}>()

const show = ref(false)

const slideData = ref<Partial<SlideData>>({})
const uniqueId = ref('')
const showSuccess = ref(false)
const showFailed = ref(false)

const events = {
  refresh: () => {
    Apis.captcha
      .gen()
      .then((res) => {
        slideData.value = res
        uniqueId.value = res.uniqueId
      })
      .catch(() => {
        slideData.value = {}
        uniqueId.value = ''
      })
  },
  close: () => {
    show.value = false
  },
  confirm: (dot: SlidePoint, reset: () => void) => {
    const uniId = uniqueId.value
    Apis.captcha
      .verify({
        data: {
          uniqueId: uniId,
          x: dot.x,
          y: dot.y,
        },
      })
      .then((res) => {
        if (!res.success) throw new Error('verify error')
      })
      .then(() => {
        showSuccess.value = true
        setTimeout(() => {
          show.value = false
          showSuccess.value = false
          emit('success', uniId)
        }, 600)
      })
      .catch(() => {
        setTimeout(() => {
          events.refresh()
        }, 350)
        showFailed.value = true
        setTimeout(() => {
          showFailed.value = false
          reset()
        }, 500)
      })
  },
}

defineExpose({
  show: () => {
    // 先开弹窗再拉取，避免 refresh 异常时弹窗无声无息打不开
    show.value = true
    events.refresh()
  },
})
</script>
<style lang="scss">
:root[theme-mode='dark'] {
  --go-captcha-theme-text-color: #8f94a7 !important;
  --go-captcha-theme-bg-color: #18181a !important;
  --go-captcha-theme-btn-color: #ffffff !important;
  --go-captcha-theme-btn-bg-color: #4e87ff !important;
  --go-captcha-theme-btn-border-color: #4e87ff !important;
  --go-captcha-theme-active-color: #3e7cff !important;
  --go-captcha-theme-border-color: #3c3f44 !important;
  --go-captcha-theme-icon-color: #696d7b !important;
  --go-captcha-theme-drag-bar-color: #3c3f44 !important;
  --go-captcha-theme-drag-bg-color: #3e7cff !important;
  --go-captcha-theme-drag-icon-color: #ffffff !important;
  --go-captcha-theme-round-color: #3c3f44 !important;
  --go-captcha-theme-loading-icon-color: #3e7cff !important;
  --go-captcha-theme-body-bg-color: #34383e !important;
  --go-captcha-theme-dot-color: #cedffe !important;
  --go-captcha-theme-dot-bg-color: #3e7cff !important;
  --go-captcha-theme-dot-border-color: #f7f9fb !important;
}

.go-captcha-wrapper {
  .lottie {
    width: 60px;
    height: 60px;
    z-index: 3;
  }
}

.go-captcha {
  img {
    -webkit-user-drag: none;
    user-select: none;
    cursor: default !important;
  }
}
</style>
