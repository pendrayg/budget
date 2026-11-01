// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { amountForClipboard } from '../lib/format'
import CopyAmount from './CopyAmount'

describe('CopyAmount', () => {
  afterEach(() => vi.useRealTimers())

  it('copie le montant comme on le colle dans un virement', () => {
    expect(amountForClipboard(1234.5)).toBe('1234,50')
    expect(amountForClipboard(-12.3)).toBe('-12,30')
  })

  it('copie au clic et dit « Copié » une seconde', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<CopyAmount value={1234.5} />)
    const amount = screen.getByText(/1\s234,50\s€/)
    await act(async () => {
      fireEvent.click(amount)
    })
    expect(writeText).toHaveBeenCalledWith('1234,50')
    expect(amount.textContent).toBe('Copié')
    act(() => vi.advanceTimersByTime(1000))
    expect(amount.textContent).toMatch(/1\s234,50\s€/)
  })
})
