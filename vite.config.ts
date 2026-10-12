import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // `npm run worker:dev` sert le Worker sur 8787 : les cours passent par lui en dev.
      '/api': 'http://localhost:8787',
    },
  },
})
