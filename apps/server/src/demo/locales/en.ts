import type { I18nLocaleMessages } from '@pika/elysia-plugins'
import type { zh } from './zh'

export const en = {
  HELLO: 'hello demo',
} satisfies I18nLocaleMessages<typeof zh>
