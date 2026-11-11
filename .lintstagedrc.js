export default {
  '*.{js,jsx,ts,tsx,md,json}': ['prettier --write'],
  'apps/server/**/*.{ts,tsx}': [() => 'bun check:server'],
  'apps/web/**/*.{ts,tsx,vue,json}': [() => 'bun check:web'],
  'packages/bun-plugins/**/*.{ts,tsx,json}': [() => 'bun check:bun-plugins'],
  'packages/elysia-common/**/*.{ts,tsx,json}': [() => 'bun check:elysia-common'],
  'packages/elysia-hook/**/*.{ts,tsx,json}': [() => 'bun check:elysia-hook'],
  'packages/elysia-openapi/**/*.{ts,tsx,json}': [() => 'bun check:elysia-openapi'],
  'packages/elysia-plugins/**/*.{ts,tsx,json}': [() => 'bun check:elysia-plugins'],
  'packages/rate-limit/**/*.{ts,tsx,json}': [() => 'bun check:rate-limit'],
  'packages/shared/**/*.{ts,tsx,json}': [() => 'bun check:shared'],
  'packages/typeorm/**/*.{ts,tsx,json}': [() => 'bun check:typeorm'],
  'packages/wrap-naive-ui/**/*.{ts,tsx,json}': [() => 'bun check:wrap-naive-ui'],
}
