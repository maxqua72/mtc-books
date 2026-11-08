import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '@fortawesome/fontawesome-free/css/fontawesome.min.css'
import '@fortawesome/fontawesome-free/css/solid.min.css'
import '@fortawesome/fontawesome-free/css/regular.min.css'

import './style.css'
import './assets/styles/theme.css'
import './assets/styles/tooltip.css'
import './assets/styles/tour.css'
import App from './App.vue'
import NotebookApp from './notebook/NotebookApp.vue'
import { shouldOpenNotebook } from './notebook/notebookRoute'
import { registerServiceWorker } from './notebook/serviceWorker'
import { capabilities } from './platform'
import { useThemeStore } from './stores/themeStore'

// Sul telefono si apre il Taccuino; l'editor completo resta raggiungibile dal suo menu
const notebook = shouldOpenNotebook(capabilities.nativeFiles)
const app = createApp(notebook ? NotebookApp : App)
const pinia = createPinia()

app.use(pinia)
// Il tema si legge da IndexedDB prima del montaggio: così non si vede il passaggio da uno stile all'altro
useThemeStore(pinia).init().finally(() => app.mount('#app'))

// Uso senza rete (Taccuino installato sul telefono): solo nella versione web pubblicata
if (!capabilities.nativeFiles) registerServiceWorker()
