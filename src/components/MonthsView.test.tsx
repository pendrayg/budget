// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { seedState } from '../lib/fixtures'
import type { State } from '../lib/types'
import MonthsView from './MonthsView'

// jsdom ne mesure rien : les graphiques et les sections dépliantes observent une taille qui ne vient pas.
beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})

afterEach(cleanup)

/** La graine, et un relevé de septembre 2026 : une dépense qui dépasse, deux opérations à ranger. */
function withStatement(): State {
  const state = seedState()
  const category = state.categories[0]
  const updatedAt = '2026-10-01T00:00:00.000Z'
  return {
    ...state,
    transactions: [
      { id: 't1', date: '2026-09-03', label: 'CB GROS ACHAT', amount: 100_000, categoryId: category.id, updatedAt },
      { id: 't2', date: '2026-09-12', label: 'CB MARCHE', amount: 42, updatedAt },
      { id: 't3', date: '2026-09-14', label: 'CB BOULANGERIE', amount: 8.5, updatedAt },
    ],
  }
}

const view = (state: State) =>
  render(<MonthsView state={state} month="2026-10" missing={[]} scope={null} update={() => {}} onEnterMonth={() => {}} />)

describe('MonthsView', () => {
  it('liste chaque mois avec ses revenus, et en seconde ligne ses dépassements et ses opérations à ranger', () => {
    const { container } = view(withStatement())
    const september = [...container.querySelectorAll('.line-button')].find((line) => /sept\. 2026/i.test(line.textContent ?? ''))
    expect(september?.textContent).toContain('2\u202f195,00')
    expect(september?.textContent).toContain('1 dépassement · 2 à ranger')
    expect(september?.classList.contains('line-incomplete')).toBe(true)
  })

  it('n’ajoute pas de seconde ligne à un mois sans relevé', () => {
    const { container } = view(withStatement())
    const august = [...container.querySelectorAll('.line-button')].find((line) => /août 2026/i.test(line.textContent ?? ''))
    expect(august?.textContent).not.toMatch(/dépassement|à ranger/)
  })

  it('propose de saisir un mois et d’importer un relevé', () => {
    const { getByRole } = view(seedState())
    expect(getByRole('button', { name: 'Saisir un mois' })).toBeTruthy()
    expect(getByRole('button', { name: 'Importer un relevé' })).toBeTruthy()
  })
})
