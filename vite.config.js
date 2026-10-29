import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [vue()],
    server: {
      port: 5173,
      // En desarrollo, /api se reenvía a tu proyecto publicado (VITE_API_TARGET).
      proxy: { '/api': { target: env.VITE_API_TARGET || 'http://localhost:8788', changeOrigin: true } },
    },
    test: { environment: 'node' },
  }
})
