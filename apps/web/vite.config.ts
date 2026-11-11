import { fileURLToPath, URL } from 'node:url'

import { ConfigEnv, defineConfig, loadEnv, UserConfig } from 'vite'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'

import VueRouter from 'vue-router/vite'

import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'

import { NaiveUiResolver } from 'unplugin-vue-components/resolvers'
import { NaivePlusResolver } from 'naive-plus/resolver'
import { WrapNaiveUiResolver } from '@pika/wrap-naive-ui/resolver'

import { VueRouterAutoImports } from 'vue-router/unplugin'
import { openapiGenerator } from '@seepine/openapi-generator/vite'

import { compression } from 'vite-plugin-compression2'

// https://vite.dev/config/
export default (config: ConfigEnv): UserConfig => {
  const env = loadEnv(config.mode, process.cwd())
  const serverUrl = env['VITE_HTTP_BASE_URL'] || 'http://127.0.0.1:9528'
  return defineConfig({
    plugins: [
      VueRouter({
        routesFolder: [{ src: 'src/pages' }, { src: 'src/views', path: 'views/' }],
        exclude: ['**/components/*', '**/composables/*', '**/*-option.ts'],
      }),
      vue(),
      VueI18nPlugin({
        include: [fileURLToPath(new URL('./src/locales/**', import.meta.url))],
      }),
      vueJsx(),
      vueDevTools(),
      UnoCSS(),
      AutoImport({
        imports: ['vue', 'pinia', VueRouterAutoImports],
        dirs: ['src/stores/**', 'src/composables/**'],
        dts: 'auto-imports.d.ts',
      }),
      Components({
        resolvers: [NaiveUiResolver(), NaivePlusResolver(), WrapNaiveUiResolver()],
        dts: 'components.d.ts',
      }),
      openapiGenerator({ input: `${serverUrl}/api/openapi/json`, watchDebounce: 5 }),
      compression({ algorithms: ['gzip'] }),
    ],
    build: {
      manifest: true,
      target: 'es2020',
      rolldownOptions: {
        output: {
          minify: true,
          codeSplitting: {
            groups: [
              { name: 'vendor-vue', test: /[\\/](?:vue|pinia|vue-router|@vue)[\\/]/ },
              { name: 'vendor-utils', test: /[\\/](?:dayjs|es-toolkit|@vueuse|alova)[\\/]/ },
              { name: 'vendor-naive', test: /[\\/](?:naive-ui)[\\/]/ },
              { name: 'vendor-naive-plus', test: /[\\/](?:naive-plus)[\\/]/ },
              { name: 'vendor-captcha', test: /[\\/]go-captcha-vue[\\/]/ },
            ],
          },
        },
      },
    },
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: {
      host: '0.0.0.0',
      port: 9527,
      open: false,
      cors: true,
      proxy: {
        '/api': {
          target: serverUrl,
          changeOrigin: true,
          secure: false,
          ws: true,
        },
      },
    },
  })
}
