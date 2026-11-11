import type { BunPlugin } from 'bun'
import { existsSync } from 'node:fs'
import { cp, rm } from 'node:fs/promises'

export interface AssetsPluginOptions {
  /** 资源文件或目录列表（相对 cwd），仅在 js 模式产物中拷贝到 dist */
  assets?: string[]
  /** 编译时嵌入二进制的资源列表 */
  compileAssets?: string[]
  /** 构建前后复制的文件/目录对 */
  copyFiles?: { sourcePath: string; targetPath: string }[]
  /** 是否只在编译为二进制时执行 copyFiles，默认 true */
  copyFilesOnlyCompile?: boolean
}

export const assetsPlugin = (options: AssetsPluginOptions = {}): BunPlugin => {
  const { assets = [], compileAssets = [], copyFiles = [], copyFilesOnlyCompile = true } = options

  return {
    name: 'pika-assets',
    setup(build) {
      const compile = build.config.compile
      const mode = compile ? 'executable' : 'js'

      if (compile && typeof compile === 'object') {
        // 在 setup 中修改 build.config 有效
        compile.assets = [...(compile.assets ?? []), ...compileAssets]
      } else if (compile === true) {
        console.warn('[assets] compile: true 形态无法追加 assets，请改用 { target, assets, ... }')
      }

      const copiedTargetPaths = new Set<string>()
      const cleanupCopiedFiles = async (): Promise<void> => {
        const failed: string[] = []
        for (const targetPath of copiedTargetPaths) {
          try {
            await rm(targetPath, { force: true, recursive: true })
          } catch {
            failed.push(targetPath)
          }
        }
        copiedTargetPaths.clear()
        if (failed.length > 0) {
          console.error(
            `[assets] cleanup failed for ${failed.length} path(s): ${failed.join(', ')}`,
          )
        }
      }

      build.onStart(async () => {
        console.log(
          `[assets] start: mode=${mode}, assets=${assets.length}, compileAssets=${compileAssets.length}`,
        )
        for (const { sourcePath } of copyFiles) {
          if (!existsSync(sourcePath)) {
            throw new Error(`[assets] copy source does not exist: ${sourcePath}`)
          }
        }
        if (copyFilesOnlyCompile && mode === 'js') {
          return
        }
        try {
          for (const { sourcePath, targetPath } of copyFiles) {
            if (existsSync(targetPath)) {
              throw new Error(`[assets] copy target already exists: ${targetPath}`)
            }
            copiedTargetPaths.add(targetPath)
            await cp(sourcePath, targetPath, { force: true, recursive: true })
          }
        } catch (error) {
          await cleanupCopiedFiles()
          throw error
        }
      })

      build.onEnd(async (result) => {
        try {
          if (!result.success) {
            console.error(`[assets] failed: ${result.logs.length} log(s)`)
            for (const log of result.logs) {
              console.error(log)
            }
            return
          }
          for (const output of result.outputs) {
            console.log(`[assets] emit: ${output.path} (${output.size}B, kind=${output.kind})`)
          }

          if (mode === 'executable') {
            return
          }

          for (const asset of assets) {
            if (!existsSync(asset)) {
              continue
            }
            await cp(asset, `dist/${asset}`, { force: true, recursive: true })
          }
        } finally {
          await cleanupCopiedFiles()
        }
      })
    },
  }
}
