import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const port = parseInt(env.VITE_PORT || '6007', 10)

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port,
      allowedHosts: [
        "d62c-2407-aa80-14-4908-dd84-c434-3aac-9cf6.ngrok-free.app",
        "localhost",
        ".localhost",
      ],
    },
  }
})