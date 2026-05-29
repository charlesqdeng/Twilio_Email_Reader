import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000
  },
  preview: {
    port: 4173,
    strictPort: true  // Fail if port is in use instead of trying another
  }
})
