import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { ConfigRepository, type AppConfig } from '@/system/repositories/config'
import { ConfigService } from '@/system/services/config'

const fakeConfig: AppConfig = {
  id: '1',
  auth: { regEnabled: true, loginTypes: ['password'], regType: 'email' },
  mail: { enabled: false },
  file: { maxSize: 1024, allowedTypes: [], disabledTypes: [], ossEnabled: false },
}

/** 替换 ConfigRepository.get 并记录查库次数，避免测试依赖真实数据库 */
const mockFindConfig = () => {
  let calls = 0
  const spy = spyOn(ConfigRepository, 'get').mockImplementation(async () => {
    calls += 1
    return fakeConfig
  })
  return { spy, calls: () => calls }
}

describe('ConfigService.get 缓存', () => {
  afterEach(async () => {
    await ConfigService.clearCache()
  })

  test('缓存有效期内的多次读取只查一次库', async () => {
    const { spy, calls } = mockFindConfig()
    await ConfigService.clearCache()
    try {
      expect(await ConfigService.get()).toEqual(fakeConfig)
      expect(await ConfigService.get()).toEqual(fakeConfig)
      expect(calls()).toBe(1)
    } finally {
      spy.mockRestore()
    }
  })

  test('清除缓存后重新查库', async () => {
    const { spy, calls } = mockFindConfig()
    await ConfigService.clearCache()
    try {
      await ConfigService.get()
      await ConfigService.clearCache()
      await ConfigService.get()
      expect(calls()).toBe(2)
    } finally {
      spy.mockRestore()
    }
  })
})
