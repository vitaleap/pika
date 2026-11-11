import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { user } from '@/system/schemas/user'
import { describe, expect, test, beforeAll, afterAll } from 'bun:test'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { snowflake } from '@/common/snowflake'
import { createPGlite } from '@/common/db/plugins/pglite'

const testDatabasePath = '.tmp/.test/.db.pglite.data'
await rm(testDatabasePath, { recursive: true, force: true })
const client = await createPGlite(testDatabasePath)
const db = drizzle({ client })
await migrate(db, { migrationsFolder: join(import.meta.dir, '../../drizzle') })

describe('user', () => {
  beforeAll(async () => {
    await snowflake.init()
  })

  afterAll(async () => {
    await client.close()
    await rm(testDatabasePath, { recursive: true, force: true })
  })

  test('add', async () => {
    await db.insert(user).values({
      name: 'test',
      email: 'test@example.com',
    })
    const res = await db.select().from(user)
    expect(res).toHaveLength(1)
    expect(res[0]?.email).toBe('test@example.com')
  })
})
