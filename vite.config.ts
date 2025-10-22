import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/traffic_collisions/',
  server: { port: 5173 },
  build: { target: 'es2020' } // no rollupOptions needed anymore
})
