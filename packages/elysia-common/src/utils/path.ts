import { homedir } from 'node:os'
import { resolve } from 'node:path'

/**
 * 解析路径配置：展开 `~` 为用户主目录，并统一转为绝对路径。
 *
 * 文件存储、文件缓存等消费方不会展开 `~`，会把它当作字面目录名，
 * 因此路径类配置在传给适配器前需要经过本函数。
 */
export const resolvePath = (path: string): string => {
  if (path === '~') return homedir()
  if (/^~[/\\]/.test(path)) return resolve(homedir(), path.slice(2))
  return resolve(path)
}
