import { describe, expect, test } from 'bun:test'
import { Elysia } from 'elysia'
import { globalContextPlugin } from '@/common/plugins/global-context'
import { i18nPlugin } from '@/common/plugins/i18n'
import { defaultTimeZone, timezonePlugin } from '@/common/plugins/timezone'

const app = new Elysia()
  .use(i18nPlugin)
  .use(globalContextPlugin)
  .use(timezonePlugin)
  .get('/time', ({ timeZone, dayjs }) => ({
    timeZone,
    time: dayjs('2024-01-01T00:00:00Z').format('YYYY-MM-DD HH:mm:ss'),
  }))

describe('server timezone', () => {
  test('按 Time-Zone 请求头注入时区与 dayjs', async () => {
    const response = await app.handle(
      new Request('http://localhost/time', { headers: { 'Time-Zone': 'America/New_York' } }),
    )

    expect(await response.json()).toEqual({
      timeZone: 'America/New_York',
      time: '2023-12-31 19:00:00',
    })
  })

  test('未指定时区时使用服务器时区', async () => {
    const response = await app.handle(new Request('http://localhost/time'))

    expect(await response.json()).toMatchObject({ timeZone: defaultTimeZone })
  })

  test('非法时区回退到服务器时区', async () => {
    const response = await app.handle(
      new Request('http://localhost/time', { headers: { 'Time-Zone': 'Mars/Base' } }),
    )

    expect(await response.json()).toMatchObject({ timeZone: defaultTimeZone })
  })

  test('Vary 同时包含 Accept-Language 与 Time-Zone', async () => {
    const response = await app.handle(
      new Request('http://localhost/time', { headers: { 'Time-Zone': 'Asia/Tokyo' } }),
    )

    const vary = response.headers.get('vary')?.toLowerCase() ?? ''
    expect(vary).toContain('accept-language')
    expect(vary).toContain('time-zone')
  })

  test('请求内可通过 globalThis.ctx 获取 dayjs', async () => {
    const tzApp = new Elysia()
      .use(globalContextPlugin)
      .use(timezonePlugin)
      .get('/global-time', () => {
        const dayjs = globalThis.ctx.get('dayjs')
        return { time: dayjs('2024-01-01T00:00:00Z').format('YYYY-MM-DD HH:mm:ss') }
      })

    const response = await tzApp.handle(
      new Request('http://localhost/global-time', {
        headers: { 'Time-Zone': 'America/New_York' },
      }),
    )

    expect(await response.json()).toEqual({ time: '2023-12-31 19:00:00' })
  })
})
