import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  out: './drizzle',
  schema: './src/*/schemas',
  dialect: 'postgresql',
  driver: 'pglite',
  // NOTE: bun run db:gen 不需要数据库连接，迁移通过 common/hooks/db.ts 运行时执行，不允许手动连接生产环境数据库进行迁移
  // dbCredentials: { url: process.env.DATABASE_URL! },
  migrations: {
    schema: 'public',
  },
})
