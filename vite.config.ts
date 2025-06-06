import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/couponsystem/front/',
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3500',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
