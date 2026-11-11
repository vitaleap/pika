import { customType, snakeCase } from 'drizzle-orm/pg-core'
import { type BackgroundType } from '@pika/shared'
import { baseColumns } from '@/common/db/base/columns'

/** 单套（明亮/暗黑）外观风格 */
export type ThemeStyle = {
  /** 侧边栏背景色，空格分隔的 RGB，如 `21 21 25` */
  sidebarBgColor: string
  /** 侧边栏透明度，0-1 的字符串 */
  sidebarBgTransparency: string
  /** 背景来源 */
  mainBgType: BackgroundType
  /** 自定义上传的图片地址，切换背景类型时保留，方便用户随时切回 */
  mainBgImageUrl: string
  /** 背景模糊半径，单位 px */
  mainBgBlur: number
}

/**
 * 账号级外观风格：只保存明亮/暗黑两套侧边栏与背景设置。
 *
 * 主题模式、主题色、语言与时区属于设备偏好，由前端保存在浏览器本地，不入库。
 * 默认值同样只在前端维护：未保存过的用户不落库，方便后续调整默认值无需迁移数据。
 */
export type AppearanceConfig = {
  light: ThemeStyle
  dark: ThemeStyle
}

/**
 * 外观风格自定义类型。
 *
 * 数据库存为普通字符串（text）的 JSON 文本，读写时序列化/反序列化，
 * 不依赖具体数据库的 json 类型，方便后续切换数据库。
 */
const appearanceType = customType<{
  data: AppearanceConfig
  driverData: string
}>({
  dataType() {
    return 'text'
  },
  toDriver(value: AppearanceConfig): string {
    return JSON.stringify(value)
  },
  fromDriver(value: string): AppearanceConfig {
    return JSON.parse(value)
  },
})

export const userPreference = snakeCase.table('user_preference', (t) => ({
  ...baseColumns(t),
  userId: t.varchar({ length: 20 }).notNull().unique(),
  appearance: appearanceType().notNull(),
}))

export type UserPreference = typeof userPreference.$inferSelect
export type UserPreferenceInsert = typeof userPreference.$inferInsert
