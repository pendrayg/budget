import { describe, expect, it } from 'vitest'
import { addCategory, addGroup } from './budget'
import { seedState } from './fixtures'
import { categoriesOf, ownerFromId } from './scope'
import { importStatement, placeTransaction, removeMonth, spendingMonths, spendingSummary } from './spending'
import { sanitizeState } from './state'
import { budgetHistory, incomeHistory, monthSummary, sortedGroups } from './summary'
import type { State } from './types'

const T = '2026-10-01T08:00:00.000Z'

/** La graine, plus un budget à Bruno (p2) : une catégorie « Loisirs » et sa dépense « Sport », 60 € par mois. */
function withPersonal(): State {
  let state = addGroup(seedState(), { id: 'p2:g1', name: 'Loisirs', save: false, owner: 'p2', updatedAt: T }, null)
  state = addCategory(state, { id: 'p2:c1', name: 'Sport', updatedAt: T }, {
    categoryId: 'p2:c1',
    from: '2026-10',
    groupId: 'p2:g1',
    splitKeyId: 'prorata',
    amount: { kind: 'monthly', value: 60 },
    save: false,
    updatedAt: T,
  })
  return state
}

describe('budgets personnels', () => {
  it('reconnaît le propriétaire au préfixe de l’identifiant', () => {
    expect(ownerFromId('p2:abc', ['p1', 'p2'])).toBe('p2')
    expect(ownerFromId('2026-09-01|4106|X|0', ['p1', 'p2'])).toBeNull()
  })

  it('garde le propriétaire à l’assainissement, et le retrouve à son préfixe quand une app d’avant l’a perdu', () => {
    const state = withPersonal()
    expect(sanitizeState(state).groups.find((g) => g.id === 'p2:g1')?.owner).toBe('p2')
    const lost = { ...state, groups: state.groups.map(({ owner: _owner, ...group }) => group) }
    expect(sanitizeState(lost).groups.find((g) => g.id === 'p2:g1')?.owner).toBe('p2')
  })

  it('tient le budget commun à l’écart des catégories personnelles', () => {
    const state = withPersonal()
    expect(sortedGroups(state).some((g) => g.owner)).toBe(false)
    expect(monthSummary(state, '2026-10').total).toBeCloseTo(3374, 2)
    expect(categoriesOf(state, 'p2').map((c) => c.name)).toEqual(['Sport'])
  })

  it('fait payer tout son budget à la personne, sans répartition', () => {
    const summary = monthSummary(withPersonal(), '2026-10', 'p2')
    expect(summary.sections.map((s) => s.group.name)).toEqual(['Loisirs'])
    expect(summary.due).toEqual({ p1: 0, p2: 60 })
  })

  it('retire le budget personnel du reste à vivre et l’ajoute au taux d’effort, dans la synthèse comme mois par mois', () => {
    const before = seedState()
    const after = withPersonal()
    const summary = monthSummary(after, '2026-10')
    expect(summary.personal).toEqual({ p1: 0, p2: 60 })
    expect(summary.remaining.p2! - monthSummary(before, '2026-10').remaining.p2!).toBeCloseTo(-60, 6)
    expect(summary.remaining.p1).toBe(monthSummary(before, '2026-10').remaining.p1)
    // Le taux d'effort aussi : 60 € de plus sur le revenu moyen.
    const average = summary.prorata.averages.p2
    expect(summary.effort.p2! - monthSummary(before, '2026-10').effort.p2!).toBeCloseTo(60 / average, 6)
    // Avant le premier budget personnel (octobre 2026), c'est lui qui vaut : septembre aussi perd 60 €.
    const september = (state: State) => incomeHistory(state).find((p) => p.month === '2026-09')!.remaining.p2!
    expect(september(after) - september(before)).toBeCloseTo(-60, 6)
  })

  it('suit le budget d’une personne face à son seul revenu', () => {
    const state = withPersonal()
    const history = budgetHistory(state, '2026-10', 'p2')
    expect(history.every((p) => p.total === 60)).toBe(true)
    const september = history.find((p) => p.month === '2026-09')
    const p2 = state.incomes.find((i) => i.month === '2026-09' && i.personId === 'p2')!
    expect(september?.income).toBeCloseTo(p2.components.reduce((s, c) => s + c.amount, 0), 2)
  })
})

describe('dépenses personnelles', () => {
  const ligne = { date: '2026-10-03', label: 'CARTE 02/10/26 SALLE DE SPORT CB*1234', amount: 30 }

  it('importe au nom du compte choisi, à part du commun', () => {
    const imported = importStatement(withPersonal(), [ligne], T, 'p2')
    const [transaction] = imported.state.transactions
    expect(transaction.owner).toBe('p2')
    expect(transaction.id.startsWith('p2:')).toBe(true)
    expect(spendingMonths(imported.state)).toEqual([])
    expect(spendingMonths(imported.state, 'p2')).toEqual(['2026-10'])
    // Le même relevé au commun est une autre opération : chaque compte a les siennes.
    expect(importStatement(imported.state, [ligne], T).added).toBe(1)
    expect(removeMonth(imported.state, '2026-10').transactions).toHaveLength(1)
    expect(removeMonth(imported.state, '2026-10', 'p2').transactions).toHaveLength(0)
  })

  it('apprend les marchands compte par compte, et juge un mois personnel sur le budget personnel', () => {
    let state = importStatement(withPersonal(), [ligne], T, 'p2').state
    state = placeTransaction(state, state.transactions[0].id, { categoryId: 'p2:c1' }, T)
    expect(state.rules.every((rule) => rule.key.startsWith('p2:'))).toBe(true)
    const summary = spendingSummary(state, '2026-10', 'p2')
    expect(summary.budget).toBe(60)
    expect(summary.spent).toBe(30)
    expect(summary.sections.map((s) => s.group.name)).toEqual(['Loisirs'])
    // Au commun, le même marchand ne se range pas tout seul.
    expect(importStatement(state, [{ ...ligne, date: '2026-10-10' }], T).unsorted).toBe(1)
    // Et les opérations personnelles n'entrent pas dans le mois du commun.
    expect(spendingSummary(state, '2026-10').spent).toBe(0)
  })
})
