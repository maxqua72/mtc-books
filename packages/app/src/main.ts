import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '@fortawesome/fontawesome-free/css/fontawesome.min.css'
import '@fortawesome/fontawesome-free/css/solid.min.css'

import './style.css'
import './assets/styles/theme.css'
import './assets/styles/tooltip.css'
import App from './App.vue'
import { useThemeStore } from './stores/themeStore'


const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
// Il tema si legge da IndexedDB prima del montaggio: così non si vede il passaggio da uno stile all'altro
useThemeStore(pinia).init().finally(() => app.mount('#app'))
