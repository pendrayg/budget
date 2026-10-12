import { parseEnvelope } from './state'
import type { Envelope, State } from './types'

/**
 * Le client de `/api/state`. Des issues nommées plutôt qu'un code HTTP à interpréter partout :
 * la réponse, « pas encore de document », « session Access à refaire », et le conflit de version
 * qui rend le document courant pour qu'on fusionne.
 *
 * L'authentification est celle de Cloudflare Access, portée par son cookie : rien à joindre ici.
 * Une session expirée ne se voit pas comme un refus mais comme une REDIRECTION vers la page de
 * connexion Cloudflare, sur un autre domaine — que `fetch` ne peut pas suivre. On la demande donc
 * en manuel (`redirect: 'manual'`), et la réponse opaque qui en résulte se lit comme une session
 * à refaire, au lieu d'une panne réseau qui ferait croire le serveur injoignable.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

/** La session Cloudflare Access est expirée ou absente : il faut repasser par la connexion. */
export class SessionExpired extends ApiError {
  constructor() {
    super(401, 'Session expirée')
  }
}

export class Conflict extends ApiError {
  constructor(readonly current: Envelope) {
    super(409, 'Modifié depuis un autre appareil')
  }
}

const HEADERS: HeadersInit = { 'content-type': 'application/json' }

/** Une redirection (vers la connexion Access) ou un refus d'Access : la session est à refaire. */
function sessionLost(response: Response): boolean {
  return response.type === 'opaqueredirect' || response.status === 401 || response.status === 403 || (response.status >= 300 && response.status < 400)
}

async function failure(response: Response): Promise<ApiError> {
  if (sessionLost(response)) return new SessionExpired()
  let message = `HTTP ${response.status}`
  try {
    const body = (await response.json()) as { error?: unknown }
    if (typeof body.error === 'string') message = body.error
  } catch {
    // Pas de corps lisible : le code suffit.
  }
  return new ApiError(response.status, message)
}

/** Le document distant, ou `null` s'il n'y en a pas encore. */
export async function fetchState(signal?: AbortSignal): Promise<Envelope | null> {
  const response = await fetch('/api/state', { headers: HEADERS, signal, cache: 'no-store', redirect: 'manual' })
  if (response.status === 404) return null
  if (!response.ok) throw await failure(response)
  const envelope = parseEnvelope(await response.json())
  if (!envelope) throw new ApiError(502, 'Réponse inattendue du serveur')
  return envelope
}

/** Écrit le document ; rend sa nouvelle version, ou lève `Conflict` avec le document courant. */
export async function putState(
  version: number,
  state: State,
  options: { keepalive?: boolean } = {},
): Promise<{ version: number; savedAt: string }> {
  const response = await fetch('/api/state', {
    method: 'PUT',
    headers: HEADERS,
    redirect: 'manual',
    body: JSON.stringify({ version, state }),
    keepalive: options.keepalive,
  })
  if (response.status === 409) {
    const current = parseEnvelope(await response.json())
    if (!current) throw new ApiError(502, 'Réponse inattendue du serveur')
    throw new Conflict(current)
  }
  if (!response.ok) throw await failure(response)
  const body = (await response.json()) as { version?: unknown; savedAt?: unknown }
  if (typeof body.version !== 'number') throw new ApiError(502, 'Réponse inattendue du serveur')
  return { version: body.version, savedAt: typeof body.savedAt === 'string' ? body.savedAt : new Date().toISOString() }
}
