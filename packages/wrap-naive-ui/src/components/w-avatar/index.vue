<template>
  <NAvatar
    v-if="url"
    :src="url"
    :size="props.size"
    :round="props.round"
    :lazy="props.lazy"
    object-fit="cover"
    :style="`min-width:${props.size}px`"
  />
  <NAvatar
    v-else
    :size="props.size"
    :round="props.round"
    :color="bgColor"
    :style="`min-width:${props.size}px;font-size:${fontSizePx}px`"
  >
    {{ compText }}
  </NAvatar>
</template>

<script setup lang="ts">
import { NAvatar } from 'naive-ui'
import { computed, inject } from 'vue'
import { wConfigProviderInjectionKey } from '../../config-provider'
import { WAvatarDefaults, type WAvatarProps } from './prop'

// 预设背景色，未指定 color 时按 text/url 派生稳定索引
const RANDOM_COLORS = [
  '#3498db',
  '#9b59b6',
  '#1abc9c',
  '#2ecc71',
  '#34495e',
  '#16a085',
  '#2980b9',
  '#8e44ad',
  '#e67e22',
  '#e74c3c',
] as const

// 保留 defaultProps 为 undefined 的状态，让 w-config-provider
// 的 component-options 能在 prop 未传时介入（优先级：prop > provider > defaults）
const defaultProps = defineProps<WAvatarProps>()

const injected = inject(wConfigProviderInjectionKey, undefined)
const props = computed<WAvatarProps>(() => {
  const o = injected?.value?.Avatar
  // 过滤掉 defaultProps 中的 undefined 字段，避免未传的 prop 覆盖 provider 的有效值
  const userProps = Object.fromEntries(
    Object.entries(defaultProps).filter(([_, v]) => v !== undefined),
  ) as Partial<WAvatarProps>
  return Object.assign({}, WAvatarDefaults, o, userProps)
})

const url = computed<string | undefined>(() => {
  const src = props.value.src
  if (!src) return undefined
  const base = props.value.baseUrl
  if (/^https?:\/\//i.test(src)) {
    return base ? `${base}/api/file/avatar?url=${encodeURIComponent(src)}` : src
  }
  return base ? `${base}${src}` : src
})

// 根据 text/textMaxChars/textCase 计算需要展示的字符
const compText = computed<string>(() => {
  const t = props.value.text
  if (!t) {
    return ''
  }
  const sliced = t.slice(0, props.value.textMaxChars)
  const cs = props.value.textCase
  if (cs === 'lower') return sliced.toLowerCase()
  if (cs === 'default') return sliced
  return sliced.toUpperCase()
})

// 未指定 color 时按 text/url 哈希派生稳定颜色
const bgColor = computed<string | undefined>(() => {
  const c = props.value.color
  if (c) return c
  const seed = compText.value || url.value
  if (!seed) return undefined
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  }
  return RANDOM_COLORS[(hash >>> 0) % RANDOM_COLORS.length]!
})

const fontSizePx = computed(() => {
  const f = props.value.fontSize
  if (f) return f
  const s = props.value.size
  if (s === 'small') return 12
  if (s === 'medium') return 16
  if (s === 'large') return 20
  if (typeof s === 'number') return (s * 2) / 5
  return 16
})
</script>
