import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    allowedHosts: [
      "d62c-2407-aa80-14-4908-dd84-c434-3aac-9cf6.ngrok-free.app",
      "localhost",
      ".localhost",
    ],
  },
})