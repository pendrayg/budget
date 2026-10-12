import { afterEach, describe, expect, it, vi } from 'vitest'
import { readLocalMode, writeLocalMode } from './storage-mode'

function memoryStorage() {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('mode de stockage retenu', () => {
  it('est synchronisé par défaut, local une fois détecté, et le redevient', () => {
    vi.stubGlobal('localStorage', memoryStorage())
    expect(readLocalMode()).toBe(false)
    writeLocalMode(true)
    expect(readLocalMode()).toBe(true)
    writeLocalMode(false)
    expect(readLocalMode()).toBe(false)
  })

  it('se passe de stockage', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('bloqué')
      },
      setItem: () => {
        throw new Error('bloqué')
      },
    })
    expect(readLocalMode()).toBe(false)
    expect(() => writeLocalMode(true)).not.toThrow()
  })
})
