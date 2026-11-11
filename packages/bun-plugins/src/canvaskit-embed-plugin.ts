import type { BunPlugin } from 'bun'

/**
 * 把 canvaskit-wasm base64 内嵌进 canvaskit.js，消除运行时对外部 wasm 文件的依赖。
 * 改写策略同时兼容 `bun build --compile` 与 `--js` 两种产物形态。
 */
export const canvaskitEmbedPlugin: BunPlugin = {
  name: 'canvaskit-wasm-embed',
  setup(build) {
    build.onLoad(
      { filter: /canvaskit-wasm[\\/]bin[\\/](?:full[\\/])?canvaskit\.js$/ },
      async ({ path }) => {
        const code = await Bun.file(path).text()
        const wasmPath = path.replace(/canvaskit\.js$/, 'canvaskit.wasm')
        if (!(await Bun.file(wasmPath).exists())) {
          return
        }

        const wasmBase64 = Buffer.from(await Bun.file(wasmPath).arrayBuffer()).toString('base64')

        // canvaskit.js line ~163：注入内嵌字节并改写 sync/async 读函数。
        // `__canvaskitWasm` 返回 Buffer，与 fs.readFileSync 类型一致，
        // 可直接喂给 WebAssembly.instantiate。
        const original =
          'Ea=__dirname+"/";Ga=a=>{a=Ja(a)?new URL(a):a;return fs.readFileSync(a)};Fa=async a=>{a=Ja(a)?new URL(a):a;return fs.readFileSync(a,void 0)};'
        if (!code.includes(original)) {
          console.warn('warn: canvaskit.js 源码结构已变更，无法内嵌 wasm')
          return
        }
        const patched = code.replace(
          original,
          `Ea=__dirname+"/";var __canvaskitWasm=Buffer.from(${JSON.stringify(wasmBase64)},"base64");Ga=a=>{a=Ja(a)?new URL(a):a;return a.endsWith("canvaskit.wasm")?__canvaskitWasm:fs.readFileSync(a)};Fa=async a=>{a=Ja(a)?new URL(a):a;return a.endsWith("canvaskit.wasm")?__canvaskitWasm:fs.readFileSync(a,void 0)};`,
        )

        return { contents: patched, loader: 'js' }
      },
    )
  },
}
