type Config = {
  delay: number
  onClick: () => void | Promise<void>
  textTemplate: (countdown: number) => string
}
export const useCountdown = (cfg: Config) => {
  const countdown = ref(0)
  const text = computed(() => cfg.textTemplate(countdown.value))
  let timer: number

  onUnmounted(() => {
    if (timer) {
      clearInterval(timer)
    }
  })

  const onClick = async () => {
    if (countdown.value > 0) {
      return
    }
    await cfg.onClick()
    countdown.value = cfg.delay || 60
    if (timer) {
      clearInterval(timer)
    }
    timer = setInterval(() => {
      if (countdown.value > 0) {
        countdown.value -= 1
      } else {
        clearInterval(timer)
      }
    }, 1000)
  }
  const disabled = computed(() => countdown.value > 0)
  return { text, onClick, disabled }
}
