import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

// Both backend launch profiles expose HTTP on port 5206; set VITE_PROXY_TARGET to point elsewhere,
// e.g. VITE_PROXY_TARGET=https://localhost:7068 for the https profile.
const apiTarget = process.env.VITE_PROXY_TARGET || 'http://localhost:5206'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        secure: false, // Bỏ qua lỗi SSL tự ký của localhost
        ws: true,
      }
    }
  }
})
