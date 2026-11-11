import { Elysia } from 'elysia'
import { routes } from './routes'
// 引入模块 hook
import './hooks'

// export 模块应用，使其注册到 server/src/app.ts 的 api 实例中
export const demoApp = new Elysia({
  prefix: '/demo',
}).use(routes)
