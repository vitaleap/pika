import { createSnowflake } from '@pika/elysia-common'
import { cache } from './cache'
import { log } from './log'

const env = Bun.env

export const snowflake = createSnowflake({ cache, env, log })
