import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

// El motor de SQLite (sql.js) necesita su .wasm junto al código del proceso principal en producción.
// El sandbox lo busca con path.join(__dirname, 'sql-wasm.wasm'), así que lo copiamos ahí al terminar el build.
const copyMainAssets = {
  name: 'copy-main-assets',
  closeBundle() {
    copyFileSync(resolve('node_modules/sql.js/dist/sql-wasm.wasm'), resolve('out/main/sql-wasm.wasm'))
    // Claves gratuitas precargadas: solo si existen en local; van al build pero nunca al repo ni al zip de código.
    const keys = resolve('build-config/default-keys.json')
    if (existsSync(keys)) copyFileSync(keys, resolve('out/main/default-keys.json'))
  }
}

export default defineConfig({
  main: { plugins: [copyMainAssets] },
  preload: {
    build: {
      rollupOptions: {
        input: { index: resolve('src/preload/index.ts'), capture: resolve('src/preload/capture.ts') }
      }
    }
  },
  renderer: {
    plugins: [react()],
    build: {
      rollupOptions: {
        input: { index: resolve('src/renderer/index.html'), capture: resolve('src/renderer/capture.html') }
      }
    }
  }
})
