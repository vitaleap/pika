import { createFilesService } from '@pika/elysia-common'
import { HttpError } from '@pika/elysia-plugins'
import { ConfigService } from '@/system/services/config'
import { t } from '@/common/plugins/i18n'
import { config } from './config'

// elysia-common 的文件服务以裸 key 调用 t，包装时补全 COMMON. 命名空间。
export const { upload, download } = createFilesService({
  getFileConfig: async () => (await ConfigService.get()).file,
  t: (key) => t(`COMMON.${key}` as never),
  ErrorClass: HttpError,
  filePath: config.filePath,
})
