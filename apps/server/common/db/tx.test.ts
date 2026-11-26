import { join } from 'node:path'
import { sql, type SQL } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { runMigrate, useDb, withTransaction } from '@/common/db'

/** PGlite 返回 `{ rows }`，Bun.SQL 直接返回行数组 */
const queryRows = async <T>(query: SQL): Promise<T[]> => {
  const result = (await useDb().execute(query)) as unknown as { rows?: T[] } | T[]
  return Array.isArray(result) ? result : (result.rows ?? [])
}

const names = async () => {
  const rows = await queryRows<{ name: string }>(sql`select name from tx_test order by name`)
  return rows.map((row) => row.name)
}

/** 构造 drizzle 包装后的 Bun.SQL 错误：SQLSTATE 在 errno，code 是 Bun 自有错误码 */
const bunSqlError = (errno: string) => {
  const driverError = Object.assign(new Error('driver error'), {
    code: 'ERR_POSTGRES_SERVER_ERROR',
    errno,
  })
  return Object.assign(new Error(`Failed query: ${errno}`), { cause: driverError })
}

/** 手动控制的信号，用于精确制造并发窗口 */
const deferred = () => {
  let resolve!: () => void
  const promise = new Promise<void>((r) => (resolve = r))
  return { promise, resolve }
}

describe('withTransaction', () => {
  beforeAll(async () => {
    // 连接可能已被其他用例文件关闭，runMigrate 会按需重建
    await runMigrate({ migrationsFolder: join(import.meta.dir, '../../drizzle') })
    await useDb().execute(sql.raw('create table if not exists tx_test (name text not null)'))
  })

  beforeEach(async () => {
    await useDb().execute(sql.raw('truncate tx_test'))
  })

  afterAll(async () => {
    await useDb().execute(sql.raw('drop table if exists tx_test'))
  })

  test('提交后数据可见', async () => {
    const result = await withTransaction(async () => {
      await useDb().execute(sql`insert into tx_test (name) values ('commit')`)
      return 'ok'
    })
    expect(result).toBe('ok')
    expect(await names()).toEqual(['commit'])
  })

  test('抛错时整体回滚', async () => {
    await expect(
      withTransaction(async () => {
        await useDb().execute(sql`insert into tx_test (name) values ('rollback')`)
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    expect(await names()).toEqual([])
  })

  test('嵌套降级为 savepoint，内层回滚不影响外层', async () => {
    await withTransaction(async () => {
      await useDb().execute(sql`insert into tx_test (name) values ('outer')`)
      await expect(
        withTransaction(async () => {
          await useDb().execute(sql`insert into tx_test (name) values ('inner')`)
          throw new Error('inner boom')
        }),
      ).rejects.toThrow('inner boom')
    })
    expect(await names()).toEqual(['outer'])
  })

  test('同一父事务下的并发嵌套调用被拒绝', async () => {
    const started = deferred()
    const gate = deferred()

    await withTransaction(async () => {
      const first = withTransaction(async () => {
        await useDb().execute(sql`insert into tx_test (name) values ('first')`)
        started.resolve()
        await gate.promise
        return 'first'
      })
      await started.promise

      // 兄弟共用一条连接上的 savepoint，并发会被静默误伤，因此直接拒绝
      await expect(withTransaction(async () => 'second')).rejects.toThrow('不允许并发嵌套')

      gate.resolve()
      expect(await first).toBe('first')
    })

    expect(await names()).toEqual(['first'])
  })

  test('被拒绝的并发嵌套不会执行回调', async () => {
    const started = deferred()
    const gate = deferred()
    let called = false

    await withTransaction(async () => {
      const first = withTransaction(async () => {
        started.resolve()
        await gate.promise
      })
      await started.promise

      await expect(
        withTransaction(async () => {
          called = true
        }),
      ).rejects.toThrow('不允许并发嵌套')

      gate.resolve()
      await first
    })

    expect(called).toBe(false)
  })

  test('并发嵌套被拒绝后外层仍可继续写入并提交', async () => {
    const started = deferred()
    const gate = deferred()

    await withTransaction(async () => {
      const first = withTransaction(async () => {
        started.resolve()
        await gate.promise
        await useDb().execute(sql`insert into tx_test (name) values ('first')`)
      })
      await started.promise

      await expect(withTransaction(async () => {})).rejects.toThrow('不允许并发嵌套')

      gate.resolve()
      await first
      // 拒绝发生在 savepoint 之前，外层事务未被污染
      await useDb().execute(sql`insert into tx_test (name) values ('outer')`)
    })

    expect(await names()).toEqual(['first', 'outer'])
  })

  test('嵌套失败后释放并发限制，后续顺序嵌套照常执行', async () => {
    await withTransaction(async () => {
      await expect(
        withTransaction(async () => {
          throw new Error('boom')
        }),
      ).rejects.toThrow('boom')

      await withTransaction(async () => {
        await useDb().execute(sql`insert into tx_test (name) values ('next')`)
      })
    })

    expect(await names()).toEqual(['next'])
  })

  test('顺序兄弟嵌套各自回滚，互不影响', async () => {
    await withTransaction(async () => {
      await withTransaction(async () => {
        await useDb().execute(sql`insert into tx_test (name) values ('ok')`)
      })
      await expect(
        withTransaction(async () => {
          await useDb().execute(sql`insert into tx_test (name) values ('fail')`)
          throw new Error('boom')
        }),
      ).rejects.toThrow('boom')
    })

    expect(await names()).toEqual(['ok'])
  })

  test('更深层的顺序嵌套仍然工作', async () => {
    await withTransaction(async () => {
      await useDb().execute(sql`insert into tx_test (name) values ('outer')`)
      await withTransaction(async () => {
        await useDb().execute(sql`insert into tx_test (name) values ('mid')`)
        await expect(
          withTransaction(async () => {
            await useDb().execute(sql`insert into tx_test (name) values ('inner')`)
            throw new Error('inner boom')
          }),
        ).rejects.toThrow('inner boom')
      })
    })

    expect(await names()).toEqual(['mid', 'outer'])
  })

  test('不同父事务下的并发嵌套互不干扰', async () => {
    const run = (tag: string) =>
      withTransaction(async () => {
        await useDb().execute(sql`insert into tx_test (name) values (${tag})`)
        await withTransaction(async () => {
          await useDb().execute(sql`insert into tx_test (name) values (${tag + '-nested'})`)
        })
      })

    await Promise.all([run('a'), run('b')])

    expect(await names()).toEqual(['a', 'a-nested', 'b', 'b-nested'])
  })

  test('retries 对 40P01 生效并最终提交', async () => {
    let attempts = 0
    await withTransaction(
      async () => {
        attempts += 1
        if (attempts < 3) throw bunSqlError('40P01')
        await useDb().execute(sql`insert into tx_test (name) values ('retry')`)
      },
      { retries: 2 },
    )
    expect(attempts).toBe(3)
    expect(await names()).toEqual(['retry'])
  })

  test('PGlite 形态（code 即 SQLSTATE）同样可重试', async () => {
    let attempts = 0
    await withTransaction(
      async () => {
        attempts += 1
        if (attempts < 2) throw Object.assign(new Error('serialization failure'), { code: '40001' })
      },
      { retries: 1 },
    )
    expect(attempts).toBe(2)
  })

  test('重试次数用尽后抛出原始错误', async () => {
    let attempts = 0
    await expect(
      withTransaction(
        async () => {
          attempts += 1
          throw bunSqlError('40001')
        },
        { retries: 1 },
      ),
    ).rejects.toThrow('Failed query: 40001')
    expect(attempts).toBe(2)
  })

  test('未开启 retries 时不重试', async () => {
    let attempts = 0
    await expect(
      withTransaction(async () => {
        attempts += 1
        throw bunSqlError('40001')
      }),
    ).rejects.toThrow('Failed query: 40001')
    expect(attempts).toBe(1)
  })

  test('非可重试错误不重试', async () => {
    let attempts = 0
    await expect(
      withTransaction(
        async () => {
          attempts += 1
          throw bunSqlError('23505')
        },
        { retries: 3 },
      ),
    ).rejects.toThrow('Failed query: 23505')
    expect(attempts).toBe(1)
  })

  test.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'timeoutMs 非法时拒绝执行：%p',
    async (timeoutMs) => {
      await expect(withTransaction(async () => {}, { timeoutMs })).rejects.toThrow('timeoutMs')
    },
  )

  test.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'retries 非法时拒绝执行：%p',
    async (retries) => {
      await expect(withTransaction(async () => {}, { retries })).rejects.toThrow('retries')
    },
  )

  test('嵌套调用同样校验非法入参', async () => {
    await withTransaction(async () => {
      await expect(withTransaction(async () => {}, { timeoutMs: 0 })).rejects.toThrow('timeoutMs')
    })
  })
})
