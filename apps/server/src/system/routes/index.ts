import type { AnyElysia } from 'elysia'
import { adminConfigRouter } from './admin/config'
import { adminLoginLogRouter } from './admin/login-log'
import { adminUserRouter } from './admin/user'
import { authRouter } from './auth'
import { captchaRouter } from './captcha'
import { fileRouter } from './file'
import { systemRouter } from './system'
import { userRouter } from './user'

// 保留 tuple 类型，让 Elysia 的 `.use` 正确合并每个路由
const defineRoutes = <const Routes extends AnyElysia[]>(routes: Routes) => routes

export const routes = defineRoutes([
  systemRouter,
  authRouter,
  captchaRouter,
  fileRouter,
  userRouter,
  adminConfigRouter,
  adminUserRouter,
  adminLoginLogRouter,
])
