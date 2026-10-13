import { describe, expect, it } from 'vitest'
import { addGroup, budgetAt, moveCategory } from './budget'
import { seedState } from './fixtures'
import { importStatement, placeTransaction, spendingSummary } from './spending'
import { monthSummary } from './summary'
import type { State } from './types'

const T = '2026-10-12T08:00:00.000Z'

/**
 * Une dépense du commun (c09) passe au budget de Bruno en novembre : une version à partir de ce
 * mois, dans une catégorie à lui. Octobre reste au commun, budget comme opérations.
 */
function moved(): State {
  let state = addGroup(seedState(), { id: 'p2:g', name: 'Courant', save: false, owner: 'p2', updatedAt: T }, null)
  state = moveCategory(state, 'c09', 'p2:g', 'p2', '2026-11', T)
  for (const date of ['2026-10-04', '2026-11-04']) {
    state = importStatement(state, [{ date, label: `CARTE SUPERMARCHE ${date}`, amount: 41 }], T).state
    state = placeTransaction(state, state.transactions.find((t) => t.date === date)!.id, { categoryId: 'c09' }, T)
  }
  return state
}

const has = (summary: ReturnType<typeof monthSummary>, id: string) => summary.sections.some((s) => s.lines.some((l) => l.category.id === id))

describe('déplacer une dépense d’un budget à l’autre', () => {
  it('la compte au commun avant le mois du changement, à sa personne ensuite', () => {
    const state = moved()
    expect(has(monthSummary(state, '2026-10'), 'c09')).toBe(true)
    expect(has(monthSummary(state, '2026-11'), 'c09')).toBe(false)
    expect(has(monthSummary(state, '2026-11', 'p2'), 'c09')).toBe(true)
    expect(has(monthSummary(state, '2026-10', 'p2'), 'c09')).toBe(false)
  })

  it('garde rangées les opérations des mois d’avant, et rend à ranger celles du commun d’après', () => {
    const state = moved()
    expect(spendingSummary(state, '2026-10').unsorted).toHaveLength(0)
    // Après le changement, la dépense n'est plus au commun : son opération du compte commun est à ranger.
    expect(spendingSummary(state, '2026-11').unsorted.map((t) => t.date)).toEqual(['2026-11-04'])
  })
})

describe('vers un budget sans catégorie', () => {
  it('fait naître une catégorie du même type chez sa personne, et garde le montant', () => {
    const state = moveCategory(seedState(), 'c09', 'p2:new', 'p2', '2026-11', T)
    const group = state.groups.find((g) => g.id === 'p2:new')!
    expect(group).toMatchObject({ owner: 'p2', save: false, name: 'Dépenses' })
    expect(budgetAt(state, 'c09', '2026-11')!.amount).toEqual(budgetAt(state, 'c09', '2026-10')!.amount)
    expect(budgetAt(state, 'c09', '2026-10')!.groupId).not.toBe('p2:new')
  })
})
