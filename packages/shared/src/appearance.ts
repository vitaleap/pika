/**
 * 外观风格相关的跨端共享常量。
 *
 * 前端（滑块取值范围）与服务端（zod 校验上限）引用同一份定义，避免两侧各自调整导致保存接口 422。
 */

/** 背景来源：纯色 / 内置墙纸 / 自定义上传图片 */
export const BACKGROUND_TYPES = ['color', 'wallpaper', 'image'] as const

/** 背景来源类型 */
export type BackgroundType = (typeof BACKGROUND_TYPES)[number]

/** 背景模糊半径上限，单位 px */
export const MAIN_BG_BLUR_MAX = 40
