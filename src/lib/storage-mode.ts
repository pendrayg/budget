/**
 * Le mode de stockage détecté, retenu sur l'appareil : sans espace KV, l'app s'ouvre directement
 * en local, sans passer par « Lecture du serveur… » ni montrer de synchronisation.
 */

const STORAGE_MODE_KEY = 'budget:storage'

/** `true` si la dernière lecture a dit que le Worker n'a pas d'espace KV. */
export function readLocalMode(): boolean {
  try {
    return localStorage.getItem(STORAGE_MODE_KEY) === 'local'
  } catch {
    return false
  }
}

export function writeLocalMode(local: boolean): void {
  try {
    if (local) localStorage.setItem(STORAGE_MODE_KEY, 'local')
    else localStorage.removeItem(STORAGE_MODE_KEY)
  } catch {
    // Pas de stockage : le mode sera redétecté à la prochaine ouverture.
  }
}
