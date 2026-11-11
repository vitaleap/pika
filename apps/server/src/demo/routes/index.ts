import type { AnyElysia } from 'elysia'
import { v1Router } from './v1'

const defineRoutes = <const Routes extends AnyElysia[]>(routes: Routes) => routes

export const routes = defineRoutes([v1Router])
