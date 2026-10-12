import { useCallback, useEffect, useRef, useState } from 'react'
import { Conflict, NoStorage, SessionExpired, fetchState, putState } from '../lib/api'
import { mergeStates } from '../lib/merge'
import { defaultState, parseEnvelope, sanitizeState } from '../lib/state'
import { readLocalMode, writeLocalMode } from '../lib/storage-mode'
import type { Envelope, State } from '../lib/types'

const MIRROR_KEY = 'budget:state:v1'
/** Le temps de finir une frappe avant d'écrire : une version par geste, pas par touche. */
const PUSH_DELAY_MS = 500
/** Après une écriture, le temps que KV se propage avant de vérifier qu'elle a bien pris. */
const VERIFY_DELAY_MS = 2000

/** Ce que l'appareil garde : le document, sa version, et s'il a des changements non envoyés. */
interface Mirror {
  version: number
  dirty: boolean
  state: State
}

export type SyncStatus =
  /** À jour, ou rien à faire. */
  | 'idle'
  | 'loading'
  | 'saving'
  /** Le serveur n'a pas répondu : les changements attendent sur ce téléphone. */
  | 'offline'
  /** Le Worker n'a pas d'espace KV : le document vit sur cet appareil. Un mode, pas une panne. */
  | 'local'
  /** Le serveur a répondu autre chose qu'une session expirée ou un conflit. */
  | 'error'

export interface SharedState {
  state: State
  update: (change: (state: State) => State) => void
  replace: (state: State) => void
  status: SyncStatus
  /** Ce qui s'est passé de notable, à montrer une fois : une fusion, une panne. */
  notice: string | null
  dismissNotice: () => void
  dirty: boolean
  version: number
  sync: () => void
}

function loadMirror(): Mirror | null {
  try {
    const raw = localStorage.getItem(MIRROR_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    const envelope = parseEnvelope(parsed)
    if (!envelope) return null
    const dirty = typeof parsed === 'object' && parsed !== null && (parsed as { dirty?: unknown }).dirty === true
    return { version: envelope.version, dirty, state: envelope.state }
  } catch {
    return null
  }
}

function saveMirror(mirror: Mirror): void {
  try {
    localStorage.setItem(MIRROR_KEY, JSON.stringify({ version: mirror.version, dirty: mirror.dirty, savedAt: new Date().toISOString(), state: mirror.state }))
  } catch {
    // Quota ou navigation privée : la session reste utilisable, le serveur garde le document.
  }
}

/**
 * Le document partagé, vu depuis un téléphone.
 *
 * Le miroir local rend l'application utilisable tout de suite et hors ligne ; le serveur fait
 * foi. À l'ouverture et au retour au premier plan, on lit le distant : plus récent, on l'adopte
 * — fusionné avec les changements locaux non envoyés, s'il y en a. Toute modification part
 * après une demi-seconde de calme ; un conflit (409) se fusionne et repart ; une panne laisse
 * le local marqué « à envoyer ». On n'envoie JAMAIS un local périmé sans l'avoir fusionné.
 *
 * Sans espace KV (501), le miroir local devient le seul document : on n'envoie plus rien. Ce
 * mode est retenu sur l'appareil pour s'ouvrir directement en local ; chaque retour au premier
 * plan revérifie EN SILENCE (ni spinner ni statut), au cas où un espace aurait été lié depuis.
 */
export function useSharedState(onSessionExpired: () => void): SharedState {
  const [mirror, setMirror] = useState<Mirror>(() => loadMirror() ?? { version: 0, dirty: false, state: defaultState() })
  const [status, setStatus] = useState<SyncStatus>(() => (readLocalMode() ? 'local' : 'idle'))
  const [notice, setNotice] = useState<string | null>(null)

  const mirrorRef = useRef(mirror)
  mirrorRef.current = mirror
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const verifyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlight = useRef(false)
  /** Le Worker a dit qu'il n'a pas d'espace KV : rien à envoyer jusqu'à la prochaine lecture. */
  const noStorage = useRef(readLocalMode())
  const expiredRef = useRef(onSessionExpired)
  expiredRef.current = onSessionExpired

  useEffect(() => saveMirror(mirror), [mirror])

  /** Adopte un document distant plus récent, en gardant ce qui n'a pas encore été envoyé. */
  const adopt = useCallback((remote: Envelope) => {
    const local = mirrorRef.current
    if (remote.version <= local.version) return
    if (local.dirty) {
      setMirror({ version: remote.version, dirty: true, state: mergeStates(local.state, remote.state) })
      setNotice('Fusionné avec les modifications de l’autre téléphone.')
    } else {
      setMirror({ version: remote.version, dirty: false, state: remote.state })
    }
  }, [])

  const pull = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    // En local, la revérification ne se voit pas : rien ne change tant que le Worker répond 501.
    if (!noStorage.current) setStatus('loading')
    try {
      const remote = await fetchState()
      if (noStorage.current) {
        // Un espace KV vient d'être lié : ce qui attendait sur le téléphone repart.
        noStorage.current = false
        writeLocalMode(false)
        if (mirrorRef.current.dirty) setMirror((m) => ({ ...m }))
      }
      if (remote) adopt(remote)
      else if (mirrorRef.current.version > 0) {
        // Le serveur a été vidé (nouvel espace KV) : ce téléphone a le document, il le renvoie.
        setMirror((m) => ({ ...m, version: 0, dirty: true }))
      }
      setStatus('idle')
    } catch (error) {
      if (error instanceof SessionExpired) expiredRef.current()
      else if (error instanceof NoStorage) {
        noStorage.current = true
        writeLocalMode(true)
        setStatus('local')
      } else if (!noStorage.current) setStatus('offline')
    } finally {
      inFlight.current = false
    }
  }, [adopt])

  const push = useCallback(async () => {
    if (inFlight.current) return
    const sending = mirrorRef.current
    if (!sending.dirty || noStorage.current) return
    inFlight.current = true
    setStatus('saving')
    try {
      const result = await putState(sending.version, sending.state)
      setMirror((m) => ({
        version: result.version,
        // Si l'on a encore tapé pendant l'envoi, il reste quelque chose à envoyer.
        dirty: m.state !== sending.state,
        state: m.state,
      }))
      setStatus('idle')
      // KV se propage en quelques secondes : on relit pour s'assurer que c'est bien notre version.
      if (verifyTimer.current) clearTimeout(verifyTimer.current)
      verifyTimer.current = setTimeout(() => void pull(), VERIFY_DELAY_MS)
    } catch (error) {
      if (error instanceof SessionExpired) {
        expiredRef.current()
      } else if (error instanceof Conflict) {
        adopt(error.current)
        setMirror((m) => ({ ...m, dirty: true }))
        setStatus('idle')
      } else if (error instanceof NoStorage) {
        noStorage.current = true
        writeLocalMode(true)
        setStatus('local')
      } else {
        setStatus('offline')
      }
    } finally {
      inFlight.current = false
    }
  }, [adopt, pull])

  // Un changement attend une demi-seconde de calme, puis part.
  useEffect(() => {
    if (!mirror.dirty) return
    if (pushTimer.current) clearTimeout(pushTimer.current)
    pushTimer.current = setTimeout(() => void push(), PUSH_DELAY_MS)
    return () => {
      if (pushTimer.current) clearTimeout(pushTimer.current)
    }
  }, [mirror, push])

  // À l'ouverture et à chaque retour au premier plan, on relit le serveur.
  useEffect(() => {
    void pull()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void pull()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [pull])

  // Safari iOS ferme vite un onglet quitté : ce qui attend part tout de suite, sans retour.
  useEffect(() => {
    const onHide = () => {
      const m = mirrorRef.current
      if (m.dirty && !noStorage.current) void putState(m.version, m.state, { keepalive: true }).catch(() => {})
    }
    window.addEventListener('pagehide', onHide)
    return () => window.removeEventListener('pagehide', onHide)
  }, [])

  const update = useCallback((change: (state: State) => State) => {
    setMirror((m) => ({ ...m, dirty: true, state: change(m.state) }))
  }, [])

  const replace = useCallback((state: State) => {
    setMirror((m) => ({ ...m, dirty: true, state: sanitizeState(state) }))
  }, [])

  const sync = useCallback(() => {
    if (mirrorRef.current.dirty && !noStorage.current) void push()
    else void pull()
  }, [push, pull])

  return {
    state: mirror.state,
    update,
    replace,
    status,
    notice,
    dismissNotice: () => setNotice(null),
    dirty: mirror.dirty,
    version: mirror.version,
    sync,
  }
}
