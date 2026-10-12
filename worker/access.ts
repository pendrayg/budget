/**
 * Vérification du jeton Cloudflare Access.
 *
 * C'est Access qui authentifie : la page Cloudflare demande l'e-mail, envoie un code, et ne
 * laisse passer vers le Worker que les adresses que la règle autorise. À chaque requête
 * admise, il pose un jeton signé dans `Cf-Access-Jwt-Assertion`. Le Worker n'en a pas besoin
 * pour fonctionner ; le vérifier ferme les chemins qui contourneraient Access (une adresse du
 * Worker que la règle ne couvre pas, une règle supprimée par erreur) et donne l'e-mail de la
 * personne connectée de façon sûre.
 *
 * La vérification est celle que Cloudflare documente : signature RS256 contre les clés
 * publiques de l'équipe (`/cdn-cgi/access/certs`), audience égale à l'AUD de l'application,
 * émetteur égal au domaine d'équipe, jeton non expiré. Web Crypto suffit, sans dépendance.
 */

export interface AccessConfig {
  /** `votre-equipe.cloudflareaccess.com`, sans protocole. */
  teamDomain: string
  /** L'étiquette d'audience (AUD) de l'application Access. */
  aud: string
}

export interface AccessIdentity {
  email: string | null
}

interface Jwk extends JsonWebKey {
  kid?: string
}

/** Les clés de l'équipe tournent rarement : une heure de cache, et un rechargement sur clé inconnue. */
const KEYS_TTL_MS = 60 * 60 * 1000
const keyCache = new Map<string, { at: number; keys: Map<string, CryptoKey> }>()

/** Pour les tests : repartir d'un cache vide. */
export function resetAccessKeys(): void {
  keyCache.clear()
}

/** `https://equipe.cloudflareaccess.com/` ou `equipe.cloudflareaccess.com` : le même domaine. */
export function normalizeTeamDomain(value: string): string {
  return value.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '')
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4)
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function decodeJson(part: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(base64UrlToBytes(part)))
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}

async function loadKeys(teamDomain: string, force: boolean): Promise<Map<string, CryptoKey>> {
  const cached = keyCache.get(teamDomain)
  if (cached && !force && Date.now() - cached.at < KEYS_TTL_MS) return cached.keys

  const response = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`, { signal: AbortSignal.timeout(5000) })
  if (!response.ok) throw new Error(`Clés Access indisponibles (HTTP ${response.status})`)
  const body = (await response.json()) as { keys?: Jwk[] }
  const keys = new Map<string, CryptoKey>()
  for (const jwk of body.keys ?? []) {
    if (!jwk.kid || jwk.kty !== 'RSA') continue
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
    keys.set(jwk.kid, key)
  }
  keyCache.set(teamDomain, { at: Date.now(), keys })
  return keys
}

/** Le jeton de la requête : l'en-tête posé par Access, ou à défaut son cookie. */
export function readAccessToken(request: Request): string | null {
  const header = request.headers.get('cf-access-jwt-assertion')
  if (header) return header.trim()
  const cookie = request.headers.get('cookie') ?? ''
  const match = /(?:^|;\s*)CF_Authorization=([^;]+)/.exec(cookie)
  return match ? decodeURIComponent(match[1]) : null
}

/**
 * L'identité portée par un jeton valide, ou `null` s'il ne l'est pas. Une panne de la source des
 * clés lève une erreur : ce n'est pas un refus, et l'appelant répond 503 plutôt que 401.
 */
export async function verifyAccessToken(token: string, config: AccessConfig, now: Date = new Date()): Promise<AccessIdentity | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [rawHeader, rawPayload, rawSignature] = parts
  const header = decodeJson(rawHeader)
  const payload = decodeJson(rawPayload)
  if (!header || !payload || header.alg !== 'RS256' || typeof header.kid !== 'string') return null

  const teamDomain = normalizeTeamDomain(config.teamDomain)
  let keys = await loadKeys(teamDomain, false)
  let key = keys.get(header.kid)
  if (!key) {
    // Clé inconnue : Access a peut-être tourné ses clés depuis la mise en cache.
    keys = await loadKeys(teamDomain, true)
    key = keys.get(header.kid)
  }
  if (!key) return null

  let signature: Uint8Array
  try {
    signature = base64UrlToBytes(rawSignature)
  } catch {
    return null
  }
  const signed = new TextEncoder().encode(`${rawHeader}.${rawPayload}`)
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signed)
  if (!valid) return null

  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud]
  if (!audiences.includes(config.aud.trim())) return null
  if (payload.iss !== `https://${teamDomain}`) return null
  const seconds = now.getTime() / 1000
  if (typeof payload.exp !== 'number' || payload.exp <= seconds) return null
  if (typeof payload.nbf === 'number' && payload.nbf > seconds + 60) return null

  return { email: typeof payload.email === 'string' ? payload.email : null }
}
