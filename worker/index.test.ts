import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import worker, { type Env } from './index'
import { resetAccessKeys } from './access'
import { defaultState } from '../src/lib/state'

/** Un KV en mémoire : juste ce que le Worker lui demande. */
function fakeKv() {
  const store = new Map<string, string>()
  const kv = {
    async get(key: string, type?: string) {
      const raw = store.get(key)
      if (raw === undefined) return null
      return type === 'json' ? JSON.parse(raw) : raw
    },
    async put(key: string, value: string) {
      store.set(key, value)
    },
    async list({ prefix }: { prefix: string }) {
      return { keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })) }
    },
  }
  return { kv: kv as unknown as KVNamespace, store }
}

const TEAM = 'equipe.cloudflareaccess.com'
const AUD = 'aud-de-l-application'

function env(access = false): { env: Env; store: Map<string, string> } {
  const { kv, store } = fakeKv()
  const assets = { fetch: async () => new Response('asset') } as unknown as Fetcher
  return {
    env: { ASSETS: assets, BUDGET_KV: kv, ...(access ? { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD } : {}) },
    store,
  }
}

function request(path: string, init: RequestInit = {}, token?: string): Request {
  return new Request(`https://budget.example${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(token ? { 'cf-access-jwt-assertion': token } : {}), ...(init.headers ?? {}) },
  })
}

/* ---------- Un Access factice : une vraie paire RSA, ses clés publiques servies par `fetch`. ---------- */

let privateKey: CryptoKey
let otherKey: CryptoKey
let publicJwk: JsonWebKey

function b64url(bytes: Uint8Array | string): string {
  const raw = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes
  let binary = ''
  for (const byte of raw) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function sign(payload: Record<string, unknown>, key: CryptoKey = privateKey, kid = 'k1'): Promise<string> {
  const head = b64url(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' }))
  const body = b64url(JSON.stringify(payload))
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${head}.${body}`))
  return `${head}.${body}.${b64url(new Uint8Array(signature))}`
}

function claims(extra: Record<string, unknown> = {}): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000)
  return { aud: [AUD], iss: `https://${TEAM}`, email: 'yoann@exemple.fr', iat: now, exp: now + 3600, ...extra }
}

beforeAll(async () => {
  const params = { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }
  const pair = (await crypto.subtle.generateKey(params, true, ['sign', 'verify'])) as CryptoKeyPair
  const other = (await crypto.subtle.generateKey(params, true, ['sign', 'verify'])) as CryptoKeyPair
  privateKey = pair.privateKey
  otherKey = other.privateKey
  publicJwk = { ...((await crypto.subtle.exportKey('jwk', pair.publicKey)) as JsonWebKey), kid: 'k1' } as JsonWebKey
})

function serveCerts() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url === `https://${TEAM}/cdn-cgi/access/certs`) return new Response(JSON.stringify({ keys: [{ ...publicJwk, alg: 'RS256' }] }))
    return new Response('inattendu', { status: 500 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
  resetAccessKeys()
})

describe('routes', () => {
  it('sert les fichiers statiques', async () => {
    const response = await worker.fetch(new Request('https://budget.example/'), env().env)
    expect(await response.text()).toBe('asset')
  })

  it('ne connaît pas d’autre route', async () => {
    expect((await worker.fetch(request('/api/autre'), env().env)).status).toBe(404)
    expect((await worker.fetch(request('/api/state', { method: 'POST' }), env().env)).status).toBe(405)
  })

  it('laisse passer sans vérification quand Access n’est pas renseigné', async () => {
    expect((await worker.fetch(request('/api/state'), env().env)).status).toBe(404)
  })
})

describe('Cloudflare Access', () => {
  it('accepte un jeton valide', async () => {
    const fetchMock = serveCerts()
    const response = await worker.fetch(request('/api/state', {}, await sign(claims())), env(true).env)
    expect(response.status).toBe(404)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('lit aussi le cookie CF_Authorization', async () => {
    serveCerts()
    const token = await sign(claims())
    const response = await worker.fetch(request('/api/state', { headers: { cookie: `autre=1; CF_Authorization=${token}` } }), env(true).env)
    expect(response.status).toBe(404)
  })

  it('refuse sans jeton', async () => {
    serveCerts()
    expect((await worker.fetch(request('/api/state'), env(true).env)).status).toBe(401)
  })

  it('refuse un jeton signé par une autre clé', async () => {
    serveCerts()
    expect((await worker.fetch(request('/api/state', {}, await sign(claims(), otherKey)), env(true).env)).status).toBe(401)
  })

  it('refuse une autre audience, un autre émetteur, un jeton expiré', async () => {
    serveCerts()
    const e = env(true).env
    expect((await worker.fetch(request('/api/state', {}, await sign(claims({ aud: ['autre'] }))), e)).status).toBe(401)
    expect((await worker.fetch(request('/api/state', {}, await sign(claims({ iss: 'https://pirate.cloudflareaccess.com' }))), e)).status).toBe(401)
    expect((await worker.fetch(request('/api/state', {}, await sign(claims({ exp: Math.floor(Date.now() / 1000) - 10 }))), e)).status).toBe(401)
  })

  it('refuse un jeton malformé ou d’un autre algorithme', async () => {
    serveCerts()
    const e = env(true).env
    expect((await worker.fetch(request('/api/state', {}, 'pas.un.jeton'), e)).status).toBe(401)
    const none = `${b64url(JSON.stringify({ alg: 'none', kid: 'k1' }))}.${b64url(JSON.stringify(claims()))}.`
    expect((await worker.fetch(request('/api/state', {}, none), e)).status).toBe(401)
  })

  it('accepte un domaine d’équipe saisi avec son protocole', async () => {
    serveCerts()
    const { env: e } = env(true)
    const response = await worker.fetch(request('/api/state', {}, await sign(claims())), { ...e, ACCESS_TEAM_DOMAIN: `https://${TEAM}/` })
    expect(response.status).toBe(404)
  })

  it('répond 503, pas 401, quand les clés sont injoignables', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('panne', { status: 502 })))
    expect((await worker.fetch(request('/api/state', {}, await sign(claims())), env(true).env)).status).toBe(503)
  })
})

describe('document', () => {
  let e: Env
  let store: Map<string, string>
  beforeEach(() => {
    ;({ env: e, store } = env())
  })

  it('n’a rien au départ', async () => {
    expect((await worker.fetch(request('/api/state'), e)).status).toBe(404)
  })

  it('accepte une première écriture en version 0 puis la relit', async () => {
    const state = defaultState()
    const put = await worker.fetch(request('/api/state', { method: 'PUT', body: JSON.stringify({ version: 0, state }) }), e)
    expect(put.status).toBe(200)
    expect(((await put.json()) as { version: number }).version).toBe(1)

    const get = await worker.fetch(request('/api/state'), e)
    const body = (await get.json()) as { version: number; state: { people: { name: string }[] } }
    expect(body.version).toBe(1)
    expect(body.state.people[0].name).toBe('Personne 1')
  })

  it('refuse une version périmée et rend le document courant', async () => {
    const state = defaultState()
    await worker.fetch(request('/api/state', { method: 'PUT', body: JSON.stringify({ version: 0, state }) }), e)
    const stale = await worker.fetch(request('/api/state', { method: 'PUT', body: JSON.stringify({ version: 0, state }) }), e)
    expect(stale.status).toBe(409)
    expect(((await stale.json()) as { version: number }).version).toBe(1)
  })

  it('garde la version remplacée et la liste', async () => {
    const state = defaultState()
    await worker.fetch(request('/api/state', { method: 'PUT', body: JSON.stringify({ version: 0, state }) }), e)
    await worker.fetch(request('/api/state', { method: 'PUT', body: JSON.stringify({ version: 1, state }) }), e)
    expect(store.has('state:prev:1')).toBe(true)
    const list = (await (await worker.fetch(request('/api/versions'), e)).json()) as { versions: number[] }
    expect(list.versions).toEqual([1])
    expect((await worker.fetch(request('/api/versions/1'), e)).status).toBe(200)
    expect((await worker.fetch(request('/api/versions/9'), e)).status).toBe(404)
  })

  it('assainit ce qu’on lui écrit', async () => {
    await worker.fetch(request('/api/state', { method: 'PUT', body: JSON.stringify({ version: 0, state: { schema: 1, incomes: 'x' } }) }), e)
    const body = (await (await worker.fetch(request('/api/state'), e)).json()) as { state: { incomes: unknown[] } }
    expect(body.state.incomes).toEqual([])
  })

  it('rejette un corps illisible ou sans version', async () => {
    expect((await worker.fetch(request('/api/state', { method: 'PUT', body: '{' }), e)).status).toBe(400)
    expect((await worker.fetch(request('/api/state', { method: 'PUT', body: JSON.stringify({ state: {} }) }), e)).status).toBe(400)
  })
})
