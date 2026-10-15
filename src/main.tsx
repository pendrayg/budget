import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { installAppHeight } from './lib/viewport'

// L'ancien code d'accès de l'app, remplacé par Cloudflare Access : rien à garder sur l'appareil.
try {
  localStorage.removeItem('budget:access')
} catch {
  // Stockage indisponible : rien à nettoyer.
}

// En web app sur iPhone, l'écran fait toute la hauteur de l'écran (cf. viewport.ts).
installAppHeight()

const container = document.getElementById('root')
if (!container) throw new Error('Élément racine introuvable')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
