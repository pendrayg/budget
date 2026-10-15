// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
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

const view = (state: State, scope: string | null = null, props: Partial<Parameters<typeof MonthsView>[0]> = {}) =>
  render(<MonthsView state={state} month="2026-10" missing={[]} scope={scope} update={() => {}} onEnterMonth={() => {}} {...props} />)

const monthLine = (container: HTMLElement, label: RegExp) => [...container.querySelectorAll<HTMLElement>('.line-button')].find((line) => label.test(line.textContent ?? ''))
const incomesOf = (line: HTMLElement | undefined) => line?.querySelector('.income-cells-row > .numeric')?.textContent

describe('MonthsView', () => {
  it('liste chaque mois avec ses revenus, et en seconde ligne ses dépassements et ses opérations à ranger', () => {
    const { container } = view(withStatement())
    const september = monthLine(container, /sept\. 2026/i)
    expect(september?.querySelector('.month-hint')?.textContent).toBe('1 dépassement2 à ranger')
    expect(september?.querySelector('.month-hint-unsorted')?.textContent).toBe('2 à ranger')
    expect(september?.classList.contains('line-incomplete')).toBe(true)
  })

  it('n’ajoute pas de seconde ligne à un mois sans relevé', () => {
    const { container } = view(withStatement())
    const august = monthLine(container, /août 2026/i)
    expect(august?.textContent).not.toMatch(/dépassement|à ranger/)
  })

  it('sur le commun, dit les revenus du foyer, leur somme, et les détaille sans les saisir', () => {
    const { container } = view(seedState())
    const september = monthLine(container, /sept\. 2026/i)
    expect(incomesOf(september)).toBe('5\u202f145,00\u00a0€')
    const recap = september?.querySelector('.income-recap')
    expect(recap?.textContent).toContain('Alice2\u202f195,00\u00a0€')
    expect(recap?.textContent).toContain('Bruno2\u202f950,00\u00a0€')
    expect(recap?.textContent).toContain('Foyer5\u202f145,00\u00a0€')
    expect(september?.querySelector('.month-part input')).toBeNull()
  })

  it('sur le compte d’une personne, dit ses revenus et les fait saisir, sans sélecteur de personne', () => {
    const state = seedState()
    const alice = state.people[0].id
    const { container } = view(state, alice)
    const september = monthLine(container, /sept\. 2026/i)
    expect(incomesOf(september)).toBe('2\u202f195,00\u00a0€')
    expect(september?.querySelector('.income-recap')).toBeNull()
    expect(september?.querySelector('.month-part input')).not.toBeNull()
    expect(september?.querySelector('[role="radiogroup"][aria-label="Personne"]')).toBeNull()
  })

  it('ouvre la saisie d’un mois pour la personne choisie, ou pour le foyer sur le commun', () => {
    const state = seedState()
    const onEnterMonth = vi.fn()
    const first = view(state, null, { onEnterMonth })
    fireEvent.click(first.getByRole('button', { name: 'Saisir un mois' }))
    expect(onEnterMonth).toHaveBeenLastCalledWith('2026-10', undefined)
    cleanup()
    const second = view(state, state.people[1].id, { onEnterMonth })
    fireEvent.click(second.getByRole('button', { name: 'Saisir un mois' }))
    expect(onEnterMonth).toHaveBeenLastCalledWith('2026-10', state.people[1].id)
  })

  it('propose de saisir un mois et d’importer un relevé', () => {
    const { getByRole } = view(seedState())
    expect(getByRole('button', { name: 'Saisir un mois' })).toBeTruthy()
    expect(getByRole('button', { name: 'Importer un relevé' })).toBeTruthy()
  })
})
