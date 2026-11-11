import { eq } from 'drizzle-orm'
import { cache } from '@/common/cache'
import { useDb } from '@/common/db'
import { config, type Config as DbConfig } from '@/system/schemas/config'

/**
 * 业务运行时配置（auth, mail, file），持久化在数据库中。
 */
export type AppConfig = Pick<DbConfig, 'id' | 'auth' | 'mail' | 'file'>

/**
 * 按组浅合并配置：对象组逐字段合并，id 与 null/undefined 忽略。
 * 写入与更新前校验共用，保证两处合并语义一致。
 */
export const mergeConfig = (current: AppConfig, data: Partial<AppConfig>): AppConfig => {
  const merged: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    // null 整组覆盖会绕过浅合并，且列均为 NOT NULL；显式丢弃以保持防御性。
    if (key === 'id' || value === null || value === undefined) {
      continue
    }
    const currentValue = (current as Record<string, unknown>)[key]
    if (
      typeof value === 'object' &&
      !Array.isArray(value) &&
      currentValue !== null &&
      typeof currentValue === 'object' &&
      !Array.isArray(currentValue)
    ) {
      merged[key] = { ...currentValue, ...value }
    } else {
      merged[key] = value
    }
  }
  return { ...current, ...merged } as AppConfig
}

export abstract class ConfigRepository {
  /**
   * 纯读：从 DB 读取第一条配置记录，不做初始化等副作用。
   */
  static async findFirst(): Promise<AppConfig | undefined> {
    const rows = await useDb().select().from(config).limit(1)
    return rows[0] as AppConfig | undefined
  }

  /**
   * 幂等写入：表中无数据时插入空配置。
   * 由 system/hooks/init-config-data.ts 启动时调用，确保 get() 始终可读到记录，避免在读取路径上隐式写入。
   */
  static async ensureInitialized(): Promise<void> {
    await cache.lock('config:init', async () => {
      const existing = await ConfigRepository.findFirst()
      if (existing) {
        return
      }
      await useDb().insert(config).values({})
    })
  }

  /**
   * 每次直接读取 DB；读取侧的缓存由 ConfigService 负责。
   * 假设 ensureInitialized() 已在启动时执行；未初始化时抛错作为防御性兜底。
   */
  static async get(): Promise<AppConfig> {
    const existing = await ConfigRepository.findFirst()
    if (!existing) {
      throw new Error('系统配置尚未初始化')
    }
    return existing
  }

  /**
   * 浅合并更新部分配置。用 cache.lock 串行化，防止并发 PATCH 互相覆盖。
   */
  static async update(data: Partial<AppConfig>) {
    await cache.lock('system:config:update', async () => {
      const current = await ConfigRepository.get()
      const merged = mergeConfig(current, data)
      await useDb().update(config).set(merged).where(eq(config.id, current.id))
    })
  }
}
