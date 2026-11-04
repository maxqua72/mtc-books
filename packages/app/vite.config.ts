import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'

const rootPkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf-8'))

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  define: { __APP_VERSION__: JSON.stringify(rootPkg.version) },
  // In sviluppo il manuale è servito da «pnpm dev:manual»
  server: { port: 5174, strictPort: true, proxy: { '/manual': 'http://localhost:5175' } },
})