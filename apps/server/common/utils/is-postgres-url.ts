/**
 * 判断数据库连接串是否为 PostgreSQL。
 *
 * 仅识别 `postgresql://` 前缀；`postgres://` 由 `createDb` 显式报错，避免被误当作 PGlite 数据目录，
 * 因此调用方需统一使用 `postgresql://`。
 */
export const isPostgresUrl = (url: string | undefined): boolean =>
  url?.startsWith('postgresql://') ?? false
