import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true, // Automatically open browser
    proxy: {
      // Proxy WebSocket connections to backend
      '/ws': {
        target: 'ws://localhost:7744',
        ws: true,
      },
      // Proxy REST API calls to backend
      '/api': {
        target: 'http://localhost:7744',
        changeOrigin: true,
      },
      // Proxy health endpoint
      '/health': {
        target: 'http://localhost:7744',
        changeOrigin: true,
      },
    },
  },
})
