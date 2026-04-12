import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (
              id.includes('/@codemirror/')
              || id.includes('/@lezer/')
            ) {
              return 'editor'
            }

            if (id.includes('/@tauri-apps/')) {
              return 'tauri'
            }

            if (
              id.includes('/react/')
              || id.includes('/react-dom/')
              || id.includes('/scheduler/')
            ) {
              return 'react-vendor'
            }
          }

          return undefined
        },
      },
    },
  },
})
