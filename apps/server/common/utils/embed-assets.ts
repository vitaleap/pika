import { config } from '@/common/config'
import { log } from '@/common/log'
import { join } from 'node:path'

// 可执行独立程序时，debug 打印嵌入资源，方便确认是否漏了文件
if (Bun.isStandaloneExecutable && log.isLevelEnabled('debug')) {
  try {
    for (const blob of Bun.embeddedFiles) {
      const name = 'name' in blob ? blob.name : ''
      if (!name) {
        continue
      }
      log.debug({ size: blob.size, type: blob.type }, `[utils/embed-assets] ${name}`)
    }
  } catch (err) {
    log.error(err, '[utils/embed-assets] debug log error')
  }
}

/** 解析普通构建与独立可执行文件中的资源路径。 */
export const embedPath = (...filePath: string[]): string => {
  if (config.mode === 'production' && Bun.isStandaloneExecutable) {
    return join(import.meta.dir, ...filePath)
  }
  return join(...filePath)
}
