import { useStorage } from '@/utils/storage'
import { defineStore } from 'pinia'

type Config = { projectName: string } & Awaited<ReturnType<typeof Apis.system.config>>

const defaultConfig: Config = {
  projectName: 'Pika',
  mode: 'production',
  auth: {
    loginTypes: ['password'],
    regEnabled: true,
    regType: 'email',
  },
}

/**
 * 缓存可能来自旧版本，缺失的分组会让 config.auth 之类的读取抛异常，
 * 这里按分组补齐默认值，保证结构完整。
 */
const withDefaults = (cached: Partial<Config>): Config => ({
  ...defaultConfig,
  ...cached,
  auth: { ...defaultConfig.auth, ...cached.auth },
})

export const useConfigStore = defineStore('config', () => {
  const config = useStorage<Config>('config', defaultConfig)
  config.value = withDefaults(config.value)

  /** 拉取最新配置。依赖配置的页面（如注册/找回密码）进入时应主动调用，避免使用过期缓存 */
  const refresh = async () => {
    const res = await Apis.system.config()
    config.value.auth = res.auth
  }

  // 避免初始时 Apis 还未挂载
  nextTick(() => {
    void refresh()
  })

  return {
    config,
    refresh,
  }
})
