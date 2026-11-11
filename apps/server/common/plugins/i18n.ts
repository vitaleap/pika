import { createElysiaI18n } from '@pika/elysia-plugins'
import { commonLocales } from '@/common/locales'
import { demoLocales } from '@/demo/locales'
import { systemLocales } from '@/system/locales'

// 全局 i18n 实例。
//
// 字典按模块分组：
// - COMMON：src 层基础设施文案（zod、auth、jwt、file 等）
// - SYSTEM：system 业务模块文案
// - DEMO  ：demo 模块文案
//
// 插件与数据分离：插件在 `@pika/elysia-plugins` 的 createElysiaI18n，
// 数据由各模块的 `locales/` 目录提供，新模块只需在此处追加即可。
//
// 业务代码统一从此处导入 `t`，使用 `${Module}.${Key}` 形式调用。
export const i18n = createElysiaI18n({
  defaultLocale: 'zh',
  messages: {
    COMMON: commonLocales,
    SYSTEM: systemLocales,
    DEMO: demoLocales,
  },
})

export const { i18nPlugin, t, translateMessage } = i18n
