import { onStartBefore } from '@pika/elysia-hook'
import { log } from '@/common/log'

onStartBefore(async () => {
  log.info('[demo/hooks] test hook')
})
