// demo 模块 i18n 数据
import { en } from './en'
import { zh } from './zh'

// 暴露模块 locales 实例，使其注册到 server/common/plugins/i18n.ts 的 messages 中
export const demoLocales = { zh, en }
