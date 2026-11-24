import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Le français de Tesseract (cf. src/lib/ocr.ts), servi par l'app elle-même à une adresse fixe,
 * `/tessdata/fra.traineddata.gz` : Tesseract l'attend dans un dossier, sous ce nom. Il vient du
 * paquet npm, copié au build et servi tel quel en dev — rien de binaire dans le dépôt.
 */
function tessdata(): Plugin {
  const file = createRequire(import.meta.url).resolve('@tesseract.js-data/fra/4.0.0_best_int/fra.traineddata.gz')
  return {
    name: 'tessdata',
    configureServer(server) {
      server.middlewares.use('/tessdata/fra.traineddata.gz', (_request, response) => {
        response.setHeader('Content-Type', 'application/octet-stream')
        response.end(readFileSync(file))
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'tessdata/fra.traineddata.gz', source: readFileSync(file) })
    },
  }
}

export default defineConfig({
  plugins: [react(), tessdata()],
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
