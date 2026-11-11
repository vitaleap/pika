import { createTimezonePlugin } from '@pika/elysia-plugins'
import type dayjs from 'dayjs'

/**
 * 扩展 `GlobalContext` 接口，添加 `dayjs` 字段
 */
declare module '@pika/elysia-plugins' {
  interface GlobalContext {
    dayjs: (date?: dayjs.ConfigType, format?: string) => dayjs.Dayjs
  }
}

// 全局时区插件：把 `Time-Zone` 请求头解析出的时区注入 Context（`timeZone` / `dayjs`）。
//
// 注意：`.as('plugin')` 不能省略，否则钩子只作用于插件自身（本插件无路由）而永不执行；
// 同时必须注册在 `globalContextPlugin` 之后，否则 `globalThis.ctx` 尚未注入。
export const timezonePlugin = createTimezonePlugin()
  .onBeforeHandle(({ dayjs }) => {
    globalThis.ctx.set('dayjs', dayjs)
  })
  .as('plugin')

export { dayjsTz, defaultTimeZone } from '@pika/elysia-plugins'
