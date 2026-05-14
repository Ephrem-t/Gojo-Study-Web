import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/Gojo-Company-Web/',
  plugins: [react()],
  server: {
    port: 5174,
  },
})