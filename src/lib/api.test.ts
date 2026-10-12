import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, NoStorage, SessionExpired, fetchState, putState } from './api'
import { defaultState } from './state'

function respond(response: Partial<Response> & { status: number }) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ type: 'basic', ok: response.status >= 200 && response.status < 300, json: async () => ({}), ...response }) as Response))
}

afterEach(() => vi.unstubAllGlobals())

describe('session Cloudflare Access', () => {
  it('lit la redirection vers la connexion comme une session expirée, pas comme une panne', async () => {
    respond({ type: 'opaqueredirect', status: 0 })
    await expect(fetchState()).rejects.toBeInstanceOf(SessionExpired)
    await expect(putState(0, defaultState())).rejects.toBeInstanceOf(SessionExpired)
  })

  it('lit un refus du Worker comme une session expirée', async () => {
    respond({ status: 401 })
    await expect(fetchState()).rejects.toBeInstanceOf(SessionExpired)
    respond({ status: 403 })
    await expect(fetchState()).rejects.toBeInstanceOf(SessionExpired)
  })

  it('garde les autres erreurs pour ce qu’elles sont', async () => {
    respond({ status: 503, json: async () => ({ error: 'Vérification Cloudflare Access indisponible' }) })
    const error = await fetchState().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).not.toBeInstanceOf(SessionExpired)
    expect((error as Error).message).toBe('Vérification Cloudflare Access indisponible')
  })

  it('demande les redirections en manuel', async () => {
    respond({ status: 404 })
    await fetchState()
    expect(vi.mocked(fetch).mock.calls[0][1]).toMatchObject({ redirect: 'manual' })
  })
})

describe('sans sauvegarde serveur', () => {
  it('lit un 501 comme l’absence d’espace KV, en lecture comme en écriture', async () => {
    respond({ status: 501 })
    await expect(fetchState()).rejects.toBeInstanceOf(NoStorage)
    await expect(putState(0, defaultState())).rejects.toBeInstanceOf(NoStorage)
  })
})
