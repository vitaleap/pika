import 'virtual:uno.css'
import './assets/index.css'
import './api'

import { createApp } from 'vue'
import { pinia } from './stores'
import { useThemeStore } from './stores/theme'

import App from './App.vue'
import router from './router'
import { i18n } from './utils/i18n'

const themeStore = useThemeStore(pinia)
themeStore.init()

const app = createApp(App)

app.use(pinia)
app.use(router)
app.use(i18n)

app.mount('#app')
