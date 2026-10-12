/**
 * Worker de l'application Budget.
 *
 * Il sert le front statique et garde LE document du couple dans un espace KV : un seul objet
 * JSON, l'état entier, sous une clé. Pas de base, pas de journal de contenu, des réponses
 * `no-store`. L'écriture compare la version attendue à celle en place : deux téléphones qui
 * écrivent en même temps ne s'écrasent pas sans le savoir — le second reçoit le document courant
 * (409) et le fusionne avant de réessayer.
 *
 * KV est à cohérence finale : deux points de présence peuvent lire la même version quelques
 * secondes. Pour deux personnes, c'est un cas rare que la fusion par entité du client absorbe ;
 * les versions précédentes sont en outre gardées trente jours (`state:prev:<n>`) en filet.
 *
 * L'accès passe par Cloudflare Access : la règle (domaine d'e-mail) est posée devant le Worker
 * et c'est elle qui authentifie. Quand `ACCESS_TEAM_DOMAIN` et `ACCESS_AUD` sont renseignés, le
 * Worker vérifie EN PLUS le jeton qu'Access joint à chaque requête (cf. `access.ts`) : une requête
 * qui ne serait pas passée par Access est refusée. Sans ces deux variables, il fait confiance à ce
 * qui l'atteint — Access doit alors couvrir toutes ses adresses.
 */

import { sanitizeState } from '../src/lib/state'
import { readAccessToken, verifyAccessToken } from './access'

export interface Env {
  ASSETS: Fetcher
  BUDGET_KV: KVNamespace
  /** `votre-equipe.cloudflareaccess.com` : le domaine d'équipe Zero Trust. */
  ACCESS_TEAM_DOMAIN?: string
  /** L'étiquette d'audience (AUD) de l'application Access. */
  ACCESS_AUD?: string
}

const STATE_KEY = 'state'
const PREVIOUS_PREFIX = 'state:prev:'
/** Trente jours de versions précédentes : assez pour se retourner, pas de quoi encombrer. */
const PREVIOUS_TTL_S = 30 * 86_400
/** Un état de budget pèse quelques dizaines de kilooctets ; au-delà d'un mébioctet, quelque chose ne va pas. */
const MAX_BODY_BYTES = 1024 * 1024

interface Stored {
  version: number
  savedAt: string
  state: unknown
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

/**
 * `null` si la requête peut passer, sinon la réponse qui la refuse. Le refus est un 401 : le
 * front y lit une session Access à refaire et recharge la page, qui repasse par la connexion.
 */
async function gate(request: Request, env: Env): Promise<Response | null> {
  const teamDomain = env.ACCESS_TEAM_DOMAIN?.trim()
  const aud = env.ACCESS_AUD?.trim()
  if (!teamDomain || !aud) return null

  const token = readAccessToken(request)
  if (!token) return json({ error: 'Session Cloudflare Access absente' }, 401)
  try {
    const identity = await verifyAccessToken(token, { teamDomain, aud })
    return identity ? null : json({ error: 'Session Cloudflare Access invalide ou expirée' }, 401)
  } catch {
    return json({ error: 'Vérification Cloudflare Access indisponible' }, 503)
  }
}

async function readStored(env: Env): Promise<Stored | null> {
  const stored = await env.BUDGET_KV.get<Stored>(STATE_KEY, 'json')
  if (!stored || typeof stored.version !== 'number') return null
  return stored
}

async function handleGet(env: Env): Promise<Response> {
  const stored = await readStored(env)
  if (!stored) return json({ error: 'Aucun document' }, 404)
  return json({ version: stored.version, savedAt: stored.savedAt, state: sanitizeState(stored.state) })
}

async function handlePut(request: Request, env: Env, now: Date): Promise<Response> {
  const declared = Number(request.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return json({ error: 'Document trop volumineux' }, 413)

  let body: unknown
  try {
    const raw = await request.text()
    if (raw.length > MAX_BODY_BYTES) return json({ error: 'Document trop volumineux' }, 413)
    body = JSON.parse(raw)
  } catch {
    return json({ error: 'Corps illisible' }, 400)
  }
  if (typeof body !== 'object' || body === null) return json({ error: 'Corps illisible' }, 400)
  const { version, state } = body as { version?: unknown; state?: unknown }
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 0) return json({ error: 'Version manquante' }, 400)

  const stored = await readStored(env)
  const currentVersion = stored?.version ?? 0
  if (version !== currentVersion) {
    return json(
      stored
        ? { version: stored.version, savedAt: stored.savedAt, state: sanitizeState(stored.state) }
        : { version: 0, savedAt: now.toISOString(), state: sanitizeState(undefined) },
      409,
    )
  }

  const next: Stored = { version: currentVersion + 1, savedAt: now.toISOString(), state: sanitizeState(state) }
  // La version remplacée est gardée à part avant d'écrire la nouvelle : un filet, pas une histoire.
  if (stored) {
    await env.BUDGET_KV.put(`${PREVIOUS_PREFIX}${stored.version}`, JSON.stringify(stored), { expirationTtl: PREVIOUS_TTL_S })
  }
  await env.BUDGET_KV.put(STATE_KEY, JSON.stringify(next))
  return json({ version: next.version, savedAt: next.savedAt })
}

/** Les versions précédentes encore gardées, les plus récentes d'abord : de quoi restaurer à la main. */
async function handleVersions(env: Env): Promise<Response> {
  const list = await env.BUDGET_KV.list({ prefix: PREVIOUS_PREFIX })
  const versions = list.keys
    .map((key) => Number(key.name.slice(PREVIOUS_PREFIX.length)))
    .filter((n) => Number.isInteger(n))
    .sort((a, b) => b - a)
  return json({ versions })
}

async function handleVersion(env: Env, requested: string): Promise<Response> {
  if (!/^\d+$/.test(requested)) return json({ error: 'Version invalide' }, 400)
  const stored = await env.BUDGET_KV.get<Stored>(`${PREVIOUS_PREFIX}${requested}`, 'json')
  if (!stored) return json({ error: 'Version inconnue ou expirée' }, 404)
  return json({ version: stored.version, savedAt: stored.savedAt, state: sanitizeState(stored.state) })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/api/')) {
      const refused = await gate(request, env)
      if (refused) return refused

      if (url.pathname === '/api/state') {
        if (request.method === 'GET') return handleGet(env)
        if (request.method === 'PUT') return handlePut(request, env, new Date())
        return json({ error: 'Méthode non autorisée' }, 405)
      }

      if (url.pathname === '/api/versions') {
        if (request.method !== 'GET') return json({ error: 'Méthode non autorisée' }, 405)
        return handleVersions(env)
      }

      const version = /^\/api\/versions\/([^/]+)$/.exec(url.pathname)
      if (version) {
        if (request.method !== 'GET') return json({ error: 'Méthode non autorisée' }, 405)
        return handleVersion(env, version[1])
      }

      return json({ error: 'Route inconnue' }, 404)
    }

    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
