import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const contracts = (p: string) => fileURLToPath(new URL(`../contracts/${p}`, import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Keep in sync with "paths" in tsconfig.app.json (MASTERSPEC 6.1).
    alias: [
      { find: /^@contracts\/types$/, replacement: contracts('types.ts') },
      { find: /^@contracts\//, replacement: contracts('') },
    ],
  },
  server: {
    // ../contracts sits outside web/, so let the dev server read the repo root.
    fs: { allow: [repoRoot] },
    // Dev only: API on :8000, AI service on :8001 (MASTERSPEC 6.1, decision 18). 127.0.0.1, not
    // localhost: on Windows localhost costs about 2 s per new connection (MASTERSPEC section 0).
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', rewrite: (p) => p.replace(/^\/api/, '') },
      '/ai': { target: 'http://127.0.0.1:8001', rewrite: (p) => p.replace(/^\/ai/, '') },
    },
  },
})
