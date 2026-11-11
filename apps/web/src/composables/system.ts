import { throttle } from 'es-toolkit'
import { nextTick, ref } from 'vue'

export type SystemInfo = {
  isMobile: boolean
  isAndroid: boolean
  isIos: boolean

  /**
   * <=640
   */
  xs: boolean // <=640
  sm: boolean // >640
  /**
   * width 大于 768
   */
  md: boolean // >768
  lg: boolean // >1024
  xl: boolean // >1280
  xxl: boolean // >1536

  offsetWidth: number
  offsetHeight: number
  clientWidth: number
  clientHeight: number
  scrollWidth: number
  scrollHeight: number
}

export const systemInfo = ref<SystemInfo>({
  offsetWidth: 0,
  offsetHeight: 0,
  clientWidth: 0,
  clientHeight: 0,
  scrollWidth: 0,
  scrollHeight: 0,
  isMobile: false,
  isAndroid: false,
  isIos: false,
  xs: true,
  sm: false,
  md: false,
  lg: false,
  xl: false,
  xxl: false,
})
const initUa = () => {
  const ua = navigator.userAgent
  systemInfo.value.isIos = /\(i[^;]+;( U;)? CPU.+Mac OS X/.test(ua)
  systemInfo.value.isAndroid =
    ua.includes('Android') || ua.includes('Adr') || /micromessenger/.test(ua)
  systemInfo.value.isMobile = systemInfo.value.isIos || systemInfo.value.isAndroid
}
initUa()
const resetSizeScreen = (body: HTMLElement) => {
  const { clientWidth } = body
  systemInfo.value.offsetWidth = body.offsetWidth
  systemInfo.value.offsetHeight = body.offsetHeight
  systemInfo.value.clientWidth = body.clientWidth
  systemInfo.value.clientHeight = body.clientHeight
  systemInfo.value.scrollWidth = body.scrollWidth
  systemInfo.value.scrollHeight = body.scrollHeight
  systemInfo.value.xs = clientWidth < 640
  systemInfo.value.sm = clientWidth >= 640
  systemInfo.value.md = clientWidth >= 768
  systemInfo.value.lg = clientWidth >= 1024
  systemInfo.value.xl = clientWidth >= 1280
  systemInfo.value.xxl = clientWidth >= 1536
}
const resize = throttle(() => {
  nextTick(() => resetSizeScreen(document.body))
}, 100)
resize()
window.addEventListener('resize', resize)
