// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JUMP_DURATIONS } from '../ds'
import { DESIGN_SYSTEM_KEY, readDesignSystem } from './design-system'
import { ARRIVAL_KEY, jumpPhase, jumpToDesignSystem, setJumpPhase } from './hyperspace'
import { reloadPage } from './page'

vi.mock('./page', () => ({ reloadPage: vi.fn() }))

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(reloadPage).mockClear()
  setJumpPhase(null)
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('jumpToDesignSystem — le départ', () => {
  it('accélère, puis en croisière écrit le choix, marque l’arrivée et recharge', () => {
    jumpToDesignSystem('star-wars')
    expect(jumpPhase()).toBe('enter')
    expect(readDesignSystem()).toBe('neomorphism')
    expect(reloadPage).not.toHaveBeenCalled()

    vi.advanceTimersByTime(JUMP_DURATIONS.enter)
    expect(jumpPhase()).toBe('cruise')
    expect(localStorage.getItem(DESIGN_SYSTEM_KEY)).toBe('star-wars')
    expect(sessionStorage.getItem(ARRIVAL_KEY)).toBe('star-wars')
    expect(reloadPage).toHaveBeenCalledTimes(1)
  })

  it('saute aussi dans l’autre sens, vers le néomorphique', () => {
    localStorage.setItem(DESIGN_SYSTEM_KEY, 'star-wars')
    jumpToDesignSystem('neomorphism')
    vi.advanceTimersByTime(JUMP_DURATIONS.enter)
    expect(readDesignSystem()).toBe('neomorphism')
    expect(sessionStorage.getItem(ARRIVAL_KEY)).toBe('neomorphism')
    expect(reloadPage).toHaveBeenCalledTimes(1)
  })

  it('ne saute ni vers le DS courant, ni pendant un saut', () => {
    jumpToDesignSystem('neomorphism')
    expect(jumpPhase()).toBeNull()
    jumpToDesignSystem('star-wars')
    jumpToDesignSystem('star-wars')
    vi.advanceTimersByTime(JUMP_DURATIONS.enter)
    expect(reloadPage).toHaveBeenCalledTimes(1)
  })

  it('bascule sans saut sous prefers-reduced-motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }))
    jumpToDesignSystem('star-wars')
    expect(jumpPhase()).toBeNull()
    expect(readDesignSystem()).toBe('star-wars')
    expect(sessionStorage.getItem(ARRIVAL_KEY)).toBeNull()
    expect(reloadPage).toHaveBeenCalledTimes(1)
  })
})

describe('jumpPhase — l’arrivée', () => {
  it('reprend le saut en croisière sur la page née d’un saut, une seule fois', async () => {
    sessionStorage.setItem(ARRIVAL_KEY, 'star-wars')
    vi.resetModules()
    const arrived = await import('./hyperspace')
    expect(arrived.jumpPhase()).toBe('cruise')
    expect(sessionStorage.getItem(ARRIVAL_KEY)).toBeNull()

    vi.resetModules()
    const reloaded = await import('./hyperspace')
    expect(reloaded.jumpPhase()).toBeNull()
  })
})
