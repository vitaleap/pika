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
