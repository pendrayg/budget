// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JUMP_DURATIONS } from '../ds'
import { setJumpPhase } from '../lib/hyperspace'
import HyperspaceOverlay from './HyperspaceOverlay'

beforeEach(() => {
  vi.useFakeTimers()
  // jsdom ne peint pas de canvas : le champ d'étoiles se rend, sans contexte 2D.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  setJumpPhase(null)
})

const jump = () => document.querySelector('[data-testid="ds-jump"]')

describe('HyperspaceOverlay', () => {
  it('ne montre rien hors saut', () => {
    render(<HyperspaceOverlay />)
    expect(jump()).toBeNull()
  })

  it('finit le saut d’une page née d’un saut : croisière, sortie, puis plus rien', () => {
    document.documentElement.dataset.arriving = ''
    setJumpPhase('cruise')
    render(<HyperspaceOverlay />)
    // Le saut couvre la page dès le premier rendu : le noir d'index.html peut partir.
    expect(jump()?.getAttribute('data-phase')).toBe('cruise')
    expect(document.documentElement.dataset.arriving).toBeUndefined()

    act(() => vi.advanceTimersByTime(JUMP_DURATIONS.cruise))
    expect(jump()?.getAttribute('data-phase')).toBe('exit')
    act(() => vi.advanceTimersByTime(JUMP_DURATIONS.exit))
    expect(jump()).toBeNull()
  })

  it('montre l’accélération dès qu’un saut part', () => {
    render(<HyperspaceOverlay />)
    act(() => setJumpPhase('enter'))
    expect(jump()?.getAttribute('data-phase')).toBe('enter')
  })
})
