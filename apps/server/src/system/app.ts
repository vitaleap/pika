import { Elysia } from 'elysia'
import { routes } from '@/system/routes'
import './hooks'

export const systemApp = new Elysia({
  prefix: '/system',
}).use(routes)
