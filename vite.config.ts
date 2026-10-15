import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // L'adaptateur du design system (src/ds) attend le paquet élu par un `await` de premier niveau :
    // Safari 15 et suivants, comme les autres navigateurs de 2021.
    target: 'es2022',
  },
  server: {
    proxy: {
      // `npm run worker:dev` sert le Worker sur 8787 : les cours passent par lui en dev.
      '/api': 'http://localhost:8787',
    },
  },
})
