import { treaty } from '@elysia/eden'
import { type Api, startApp } from '@/app'
import { afterAll, describe, expect, test } from 'bun:test'

const { app, baseUrl } = await startApp({ port: 48526 })
const api = treaty<Api>(baseUrl)

afterAll(async () => {
  await app.stop()
})

describe('demo v1Router', () => {
  test('GET /demo/v1/health 可匿名访问', async () => {
    const { data, status, error } = await api.demo.v1.health.get()
    expect(error).toBeNull()
    expect(status).toBe(200)
    expect(data).toMatchObject({ status: 'ok' })
  })
})
