#!/usr/bin/env bun
import { build } from 'bun'
import { Command } from 'commander'
import { assetsPlugin } from '../assets-plugin'
import { canvaskitEmbedPlugin } from '../canvaskit-embed-plugin'

/** 构建时资源目录（相对 cwd），js 产物会拷贝到 dist，编译产物会内嵌进二进制 */
const assets = ['public', 'drizzle']

interface BuildCliOptions {
  js?: boolean
  embedWeb?: boolean
  target?: string
  name: string
}

const program = new Command()
  .name('pika-build')
  .description('构建 server 产物，默认编译为可执行文件，--js 则输出 js 产物')
  .option('-j, --js', '构建 js 产物（不编译为可执行文件）')
  .option('--embed-web', '内嵌 web 产物，默认不内嵌避免 docker 体积过大')
  .option('--target <target>', '编译目标平台，如 bun-windows-x64')
  .option('--name <name>', '产物名称', 'app')

program.parse()

const { js: isJs, embedWeb: isEmbedWeb, target, name: appName } = program.opts<BuildCliOptions>()

if (isJs && isEmbedWeb) {
  throw new Error('--embed-web 不支持与 --js 同时使用')
}

const res = await build({
  entrypoints: ['src/index.ts'],
  target: 'bun',
  minify: isJs,
  sourcemap: isJs ? 'linked' : false,
  outdir: 'dist',
  compile: isJs
    ? false
    : {
        outfile: target ? `${appName}-${target.replace('bun-', '')}` : appName,
        ...(target ? { target: target as any } : {}),
        windows: { hideConsole: true },
      },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'Bun.env.NODE_ENV': JSON.stringify('production'),
    'process.env.EMBED_WEB': JSON.stringify(isEmbedWeb ? 'true' : 'false'),
    'Bun.env.EMBED_WEB': JSON.stringify(isEmbedWeb ? 'true' : 'false'),
  },
  plugins: [
    canvaskitEmbedPlugin,
    assetsPlugin({
      assets,
      compileAssets: isEmbedWeb ? [...assets, 'web'] : assets,
      copyFiles: isEmbedWeb ? [{ sourcePath: '../web/dist', targetPath: 'web' }] : [],
    }),
  ],
})

const cwd = process.cwd()
for (const output of res.outputs) {
  console.log(`${output.path.replace(`${cwd}/`, '')} ${(output.size / 1024 / 1024).toFixed(2)} MB`)
}
