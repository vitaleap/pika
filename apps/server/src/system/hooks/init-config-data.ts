import { onStartBefore } from '@pika/elysia-hook'
import { ConfigRepository } from '@/system/repositories/config'
import { log } from '@/common/log'

onStartBefore(async () => {
  log.info('[system/hook] configRepository ensureInitialized')
  await ConfigRepository.ensureInitialized()
})
