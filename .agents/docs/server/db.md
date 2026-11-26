# 数据库规范

## Drizzle ORM Schema 定义

- 按 **模块** 在 `src/[moduleName]/schemas/` 中定义 schema，如 `src/system/schemas/user.ts`
- 每个表都必须使用 `baseColumns(t)` 定义标准字段 (id, createAt, updateAt 等)
- 导出 Drizzle Schema 转换的 ts 类型，例如 `User` 和 `UserInsert` (插入时类型)
- 特别说明，主键使用 `varchar` 类型，日期使用 `dayjsType` 自定义类型
- `drizzle.config.ts` 的 `schema` 字段使用 glob 形式：`./src/*/schemas`，覆盖所有模块

## Drizzle ORM Repository 定义

- 按 **模块** 在 `src/[moduleName]/repositories/` 中定义 Repository 类，如 `src/system/repositories/user.ts`
- Repository 类命名使用 `单数表名 + Repository` 后缀 (如 `UserRepository`、`ConfigRepository`)，与 `src/[moduleName]/schemas/<单数表名>.ts` 中的 schema 一一对应；导出为抽象类，方法均为静态方法
- 每个 Repository 类都应包含基础的 CRUD 方法，使用 Drizzle ORM 进行数据库操作
- 通过 `useDb()` 函数 (来自 `@/common/db`) 获取数据库实例

## 事务

- 多条写入需要原子性时，统一用 `withTransaction` (来自 `@/common/db`)：

  ```ts
  await withTransaction(async () => {
    await UserRepository.save(user)
    await ConfigRepository.update(config)
  })
  ```

- 回调内的 `useDb()` 会自动落到当前事务，Repository 无需传 `tx`；`useDb()` 在类型上不暴露 `transaction`，避免误用 `useDb().transaction()` 另开连接丢失事务上下文
- 事务内再次调用 `withTransaction` 会降级为 savepoint（内层失败只回滚内层），因此 `options` 只在最外层生效，嵌套调用会被忽略并告警；但非法入参（`retries`、`timeoutMs`）在嵌套调用中同样立即报错
- 事务内不要并发调用会开事务的方法（内部用了 `withTransaction` 的方法），并发会直接抛错；嵌套是 savepoint，作用在整条连接上，一方回滚会连带撤销另一方的写入

  ```ts
  // ❌ 抛错：A、B 内部各自开了事务
  await withTransaction(async () => {
    await Promise.all([A(), B()])
  })
  // ❌ 抛错：内存锁存在竞争问题
  await withTransaction(async () => {
    A()
    await cache.lock('key', () => B())
  })

  // ✅ 顺序执行
  await withTransaction(async () => {
    await A()
    await B()
  })
  ```

- `retries` 仅对可重试错误（40001 序列化冲突 / 40P01 死锁）生效，必须是非负整数，默认 0；开启后回调必须可重放，事务内不能有外部副作用
- `timeoutMs` 设置语句超时，仅 PostgreSQL 生效；PGlite 会忽略该设置
