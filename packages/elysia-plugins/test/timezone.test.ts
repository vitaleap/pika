import { describe, expect, test } from 'bun:test'
import { Elysia } from 'elysia'
import {
  createTimezonePlugin,
  dayjsTz,
  defaultTimeZone,
  isTimeZone,
  resolveTimeZone,
} from '../src/timezone'

const createApp = (defaultTimeZone?: string) =>
  new Elysia()
    .use(createTimezonePlugin({ defaultTimeZone }))
    .get('/time', ({ timeZone, dayjs }) => ({
      timeZone,
      time: dayjs('2024-01-01T00:00:00Z').format(),
      now: dayjs().format('YYYY-MM-DD'),
    }))

describe('isTimeZone', () => {
  test('合法时区返回 true', () => {
    expect(isTimeZone('Asia/Shanghai')).toBe(true)
    expect(isTimeZone(' America/New_York ')).toBe(true)
  })

  test('非法时区与空值返回 false', () => {
    expect(isTimeZone('Mars/Base')).toBe(false)
    expect(isTimeZone('')).toBe(false)
    expect(isTimeZone(null)).toBe(false)
    expect(isTimeZone(undefined)).toBe(false)
  })
})

describe('resolveTimeZone', () => {
  test('合法时区原样返回（去除空格）', () => {
    expect(resolveTimeZone(' Asia/Shanghai ')).toBe('Asia/Shanghai')
  })

  test('非法或缺失时回退到指定时区', () => {
    expect(resolveTimeZone('Mars/Base', 'Asia/Tokyo')).toBe('Asia/Tokyo')
    expect(resolveTimeZone(undefined, 'Asia/Tokyo')).toBe('Asia/Tokyo')
  })

  test('未指定回退时区时使用服务器时区', () => {
    expect(resolveTimeZone('Mars/Base')).toBe(defaultTimeZone)
  })
})

describe('dayjsTz', () => {
  test('按指定时区转换时间', () => {
    expect(dayjsTz('2024-01-01T00:00:00Z', 'Asia/Shanghai').format()).toBe(
      '2024-01-01T08:00:00+08:00',
    )
  })

  test('支持 format 参数', () => {
    expect(
      dayjsTz('2024-01-01 08:00:00', 'Asia/Shanghai', 'YYYY-MM-DD HH:mm:ss').format(
        'YYYY-MM-DD HH:mm:ss',
      ),
    ).toBe('2024-01-01 08:00:00')
  })

  test('不带偏移量的字符串按目标时区本地时间解析', () => {
    expect(dayjsTz('2024-01-01 08:00:00', 'Asia/Shanghai').format()).toBe(
      '2024-01-01T08:00:00+08:00',
    )
  })

  test('带偏移量的字符串按确定时刻换算', () => {
    expect(dayjsTz('2024-01-01T00:00:00+02:00', 'Asia/Shanghai').format()).toBe(
      '2024-01-01T06:00:00+08:00',
    )
  })

  test('数字字符串按时间戳处理', () => {
    expect(dayjsTz('1704067200000', 'Asia/Shanghai').format()).toBe('2024-01-01T08:00:00+08:00')
    expect(dayjsTz('1704067200', 'Asia/Shanghai').format()).toBe('2024-01-01T08:00:00+08:00')
  })

  test('11 / 12 位数字字符串按毫秒时间戳处理', () => {
    expect(dayjsTz('17040672000', 'Asia/Shanghai').format('YYYY-MM-DD')).toBe('1970-07-17')
    expect(dayjsTz('170406720000', 'Asia/Shanghai').format('YYYY-MM-DD')).toBe('1975-05-27')
  })

  test('传 format 时带偏移量的字符串仍按确定时刻换算', () => {
    expect(
      dayjsTz('2024-01-01T00:00:00Z', 'Asia/Shanghai', 'YYYY-MM-DD HH:mm:ss').format(
        'YYYY-MM-DD HH:mm:ss',
      ),
    ).toBe('2024-01-01 08:00:00')
  })

  test('8 位日期串按日期解析而不是时间戳', () => {
    expect(dayjsTz('20240101', 'Asia/Shanghai').format('YYYY-MM-DD')).toBe('2024-01-01')
  })

  test('非法时区回退到服务器时区', () => {
    expect(dayjsTz('2024-01-01T00:00:00Z', 'Mars/Base').format()).toBe(
      dayjsTz('2024-01-01T00:00:00Z').format(),
    )
  })
})

describe('createTimezonePlugin', () => {
  test('按 Time-Zone 请求头注入时区与 dayjs', async () => {
    const app = createApp()
    const response = await app.handle(
      new Request('http://localhost/time', { headers: { 'Time-Zone': 'Asia/Shanghai' } }),
    )
    const data = await response.json()

    expect(data.timeZone).toBe('Asia/Shanghai')
    expect(data.time).toBe('2024-01-01T08:00:00+08:00')
  })

  test('未指定时区时使用服务器时区', async () => {
    const app = createApp()
    const response = await app.handle(new Request('http://localhost/time'))
    const data = await response.json()

    expect(data.timeZone).toBe(defaultTimeZone)
    expect(data.time).toBe(dayjsTz('2024-01-01T00:00:00Z', defaultTimeZone).format())
  })

  test('非法时区回退到服务器时区', async () => {
    const app = createApp()
    const response = await app.handle(
      new Request('http://localhost/time', { headers: { 'Time-Zone': 'Mars/Base' } }),
    )
    const data = await response.json()

    expect(data.timeZone).toBe(defaultTimeZone)
  })

  test('支持自定义默认时区', async () => {
    const app = createApp('America/New_York')
    const response = await app.handle(new Request('http://localhost/time'))
    const data = await response.json()

    expect(data.timeZone).toBe('America/New_York')
    expect(data.time).toBe('2023-12-31T19:00:00-05:00')
  })

  test('设置 Vary: Time-Zone 响应头', async () => {
    const app = createApp()
    const response = await app.handle(
      new Request('http://localhost/time', { headers: { 'Time-Zone': 'Asia/Tokyo' } }),
    )

    expect(response.headers.get('vary')?.toLowerCase()).toContain('time-zone')
  })

  test('已有 Vary: * 时保持通配符单独出现', async () => {
    const app = new Elysia()
      .use(
        new Elysia({ name: 'preset-vary' }).derive('global', ({ set }) => {
          set.headers['vary'] = '*'
          return {}
        }),
      )
      .use(createTimezonePlugin())
      .get('/time', () => 'ok')

    const response = await app.handle(
      new Request('http://localhost/time', { headers: { 'Time-Zone': 'Asia/Tokyo' } }),
    )

    expect(response.headers.get('vary')).toBe('*')
  })

  test('超长时区值视为非法时区', async () => {
    const app = createApp('America/New_York')
    const response = await app.handle(
      new Request('http://localhost/time', { headers: { 'Time-Zone': 'A'.repeat(128) } }),
    )
    const data = await response.json()

    expect(data.timeZone).toBe('America/New_York')
  })

  test('并发请求互不干扰', async () => {
    const app = new Elysia().use(createTimezonePlugin()).get('/tz', async ({ timeZone, dayjs }) => {
      // 模拟异步操作后再构建时间，验证 derive 的闭包不会串请求
      await new Promise((resolve) => setTimeout(resolve, 5))
      return `${timeZone}|${dayjs('2024-01-01T00:00:00Z').format('HH:mm')}`
    })

    const zones = ['Asia/Shanghai', 'America/New_York', 'Europe/London', 'Asia/Tokyo']
    const responses = await Promise.all(
      zones.map((zone) =>
        app
          .handle(
            new Request('http://localhost/tz', {
              headers: { 'Time-Zone': zone },
            }),
          )
          .then((response) => response.text()),
      ),
    )

    expect(responses).toEqual([
      'Asia/Shanghai|08:00',
      'America/New_York|19:00',
      'Europe/London|00:00',
      'Asia/Tokyo|09:00',
    ])
  })
})
