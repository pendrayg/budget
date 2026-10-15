// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JUMP_DURATIONS } from '../ds'
import { DESIGN_SYSTEM_KEY } from '../lib/design-system'
import { ARRIVAL_KEY, jumpPhase, setJumpPhase } from '../lib/hyperspace'
import { reloadPage } from '../lib/page'
import AppearanceChoice from './AppearanceChoice'

vi.mock('../lib/page', () => ({ reloadPage: vi.fn() }))

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(reloadPage).mockClear()
  localStorage.clear()
  sessionStorage.clear()
  setJumpPhase(null)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  setJumpPhase(null)
})

const checked = (container: HTMLElement) => container.querySelector('[aria-checked="true"]')?.textContent

describe('AppearanceChoice', () => {
  it('montre le néomorphique par défaut, et le DS retenu sinon', () => {
    const first = render(<AppearanceChoice />)
    expect(checked(first.container)).toBe('Néomorphisme')
    cleanup()
    localStorage.setItem(DESIGN_SYSTEM_KEY, 'star-wars')
    const second = render(<AppearanceChoice />)
    expect(checked(second.container)).toBe('Star Wars')
  })

  it('choisir l’autre DS déplace la pastille et lance le saut, qui recharge en croisière', () => {
    const { container, getByRole } = render(<AppearanceChoice />)
    fireEvent.click(getByRole('radio', { name: 'Star Wars' }))
    expect(checked(container)).toBe('Star Wars')
    expect(jumpPhase()).toBe('enter')
    act(() => vi.advanceTimersByTime(JUMP_DURATIONS.enter))
    expect(localStorage.getItem(DESIGN_SYSTEM_KEY)).toBe('star-wars')
    expect(sessionStorage.getItem(ARRIVAL_KEY)).toBe('star-wars')
    expect(reloadPage).toHaveBeenCalledTimes(1)
  })
})
