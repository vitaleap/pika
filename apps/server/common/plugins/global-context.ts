import { createGlobalContextPlugin, type GlobalCtx } from '@pika/elysia-plugins'

const { ctx, plugin: globalContextPlugin } = createGlobalContextPlugin()

declare global {
  var ctx: GlobalCtx
}

globalThis.ctx = ctx

export { globalContextPlugin }
