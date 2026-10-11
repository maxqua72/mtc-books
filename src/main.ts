import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '@fortawesome/fontawesome-free/css/fontawesome.min.css'
import '@fortawesome/fontawesome-free/css/solid.min.css'

import './style.css'
import App from './App.vue'


const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.mount('#app')
