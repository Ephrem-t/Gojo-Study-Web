import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return undefined
            }

            if (id.includes('react-router') || id.includes('react-dom') || id.includes('react')) {
              return 'react-vendor'
            }

            if (id.includes('firebase')) {
              return 'firebase-vendor'
            }

            if (id.includes('jspdf')) {
              return 'jspdf-vendor'
            }

            if (id.includes('html2canvas')) {
              return 'html2canvas-vendor'
            }

            if (id.includes('xlsx') || id.includes('file-saver')) {
              return 'spreadsheet-vendor'
            }

            if (id.includes('react-icons')) {
              return 'ui-vendor'
            }

            return 'vendor'
          },
        },
      },
    },
    server: {
      host: env.VITE_DEV_HOST || '127.0.0.1',
      port: Number(env.VITE_DEV_PORT || 5173),
      proxy: {
        '/api': {
          target: env.VITE_DEV_API_PROXY_TARGET || 'http://127.0.0.1:5001',
          changeOrigin: true,
          secure: false,
        },
      },
    },
    preview: {
      host: env.VITE_PREVIEW_HOST || '127.0.0.1',
      port: Number(env.VITE_PREVIEW_PORT || 4173),
    },
  }
})
