import { describe, expect, it } from 'vitest'
import { seedState } from './fixtures'
import { monthSummary } from './summary'

describe('monthSummary', () => {
  it('retrouve le budget de l’exemple d’octobre 2026', () => {
    const summary = monthSummary(seedState(), '2026-10')
    const [save, monthly, ratio] = summary.sections
    expect(ratio.lines).toHaveLength(1)
    expect(ratio.totals.p1).toBeCloseTo(480, 2)
    expect(ratio.totals.p2).toBeCloseTo(720, 2)
    expect(save.lines.length + monthly.lines.length).toBe(21)
    expect(save.total + monthly.total).toBeCloseTo(2174, 2)
    expect(save.totals.p1 + monthly.totals.p1).toBeCloseTo(898.36, 2)
    expect(save.totals.p2 + monthly.totals.p2).toBeCloseTo(1275.64, 2)

    expect(summary.due.p1).toBeCloseTo(1378.36, 2)
    expect(summary.due.p2).toBeCloseTo(1995.64, 2)
    expect(summary.total).toBeCloseTo(3374, 2)
    expect(summary.effective.p1).toBeCloseTo(0.4085, 4)
    expect(summary.toSaveTotal).toBeCloseTo(425, 2)
    expect(summary.effort.p1).toBeCloseTo(0.6426, 4)
    expect(summary.effort.p2).toBeCloseTo(0.6552, 4)
    expect(summary.remaining.p1).toBeCloseTo(766.64, 2)
    expect(summary.remaining.p2).toBeCloseTo(1050.19, 2)
  })

  it('range les dépenses de l’exemple dans ses trois catégories, par ordre alphabétique', () => {
    const { sections, total } = monthSummary(seedState(), '2026-10')
    expect(sections.map((section) => section.group.name)).toEqual(['Prorata épargné', 'Prorata mensuel', 'Ratio'])
    const [save, monthly, ratio] = sections
    expect(ratio.group.splitKeyId).not.toBe('prorata')
    expect(ratio.shares).toEqual({ p1: 0.4, p2: 0.6 })
    expect(ratio.lines.map((line) => line.category.name)).toEqual(['Prêt immo'])
    expect(ratio.total).toBeCloseTo(1200, 2)
    expect(save.group.save).toBe(true)
    expect(save.lines.map((line) => line.category.name)).toEqual([
      'Assistance dépannage', 'Assurance scooter', 'Charges de copropriété', 'Taxe foncière', 'Vacances',
    ])
    // 60 / 12 + 240 / 12 + 150 / 3 + 1 200 / 12 + 3 000 / 12
    expect(save.total).toBeCloseTo(425, 2)
    expect(monthly.group.save).toBe(false)
    expect(monthly.lines).toHaveLength(16)
    expect(monthly.total).toBeCloseTo(1749, 2)
    // Les trois catégories font tout le budget, part par part.
    expect(ratio.total + save.total + monthly.total).toBeCloseTo(total, 6)
    expect(ratio.totals.p1 + save.totals.p1 + monthly.totals.p1).toBeCloseTo(1378.36, 2)
  })

  it('prend l’épargne de la catégorie, pas de la dépense', () => {
    const state = seedState()
    state.groups = state.groups.map((group) => (group.name === 'Ratio' ? { ...group, save: true } : group))
    expect(monthSummary(state, '2026-10').toSaveTotal).toBeCloseTo(425 + 1200, 2)
  })

  it('range une nouvelle catégorie à sa place alphabétique, sans tenir compte de la casse', () => {
    const state = seedState()
    state.groups = [...state.groups, { id: 'g-a', name: 'animaux', splitKeyId: 'prorata', save: false, updatedAt: 't' }, { id: 'g-q', name: 'Quotidien', splitKeyId: 'prorata', save: false, updatedAt: 't' }]
    expect(monthSummary(state, '2026-10').sections.map((section) => section.group.name)).toEqual(['animaux', 'Prorata épargné', 'Prorata mensuel', 'Quotidien', 'Ratio'])
  })

  it('montre une catégorie vide, à zéro', () => {
    const state = seedState()
    state.groups = [...state.groups, { id: 'g-vide', name: 'Vide', splitKeyId: 'prorata', save: false, updatedAt: 't' }]
    const vide = monthSummary(state, '2026-10').sections.find((section) => section.group.id === 'g-vide')
    expect(vide?.lines).toEqual([])
    expect(vide?.total).toBe(0)
  })

  it('ignore les dépenses pas encore créées ou archivées ce mois-là', () => {
    const state = seedState()
    const summary = monthSummary(state, '2025-09')
    expect(summary.sections.every((section) => section.lines.length === 0)).toBe(true)
    expect(summary.total).toBe(0)
    expect(summary.effort.p1).toBeNull()
  })
})

describe('budgetHistory', () => {
  it('commence au premier revenu saisi, le premier budget s’appliquant avant lui', async () => {
    const { budgetHistory } = await import('./summary')
    const state = seedState()
    const history = budgetHistory(state, '2026-10')
    // Les revenus importés vont d'octobre 2025 à septembre 2026 ; le budget commence en octobre 2026.
    expect(history.map((p) => p.month)[0]).toBe('2025-10')
    expect(history).toHaveLength(13)
    expect(history.every((p) => Math.abs(p.total - 3374) < 0.01)).toBe(true)
    expect(history.filter((p) => p.changed).map((p) => p.month)).toEqual(['2025-10'])
    // Le revenu du foyer : les deux revenus du mois ; octobre 2026 n'est pas saisi.
    const [a, b] = state.people
    const { incomeOf, incomeTotal } = await import('./prorata')
    expect(history[0].income).toBeCloseTo(incomeTotal(incomeOf(state, '2025-10', a.id)) + incomeTotal(incomeOf(state, '2025-10', b.id)), 2)
    expect(history[history.length - 1].income).toBeNull()
  })

  it('compte un revenu incomplet comme absent', async () => {
    const { budgetHistory } = await import('./summary')
    const state = seedState()
    const [, b] = state.people
    state.incomes = state.incomes.filter((income) => !(income.month === '2026-03' && income.personId === b.id))
    expect(budgetHistory(state, '2026-10').find((p) => p.month === '2026-03')?.income).toBeNull()
  })

  it('suit le total au fil des changements, en escalier', async () => {
    const { budgetHistory } = await import('./summary')
    const state = seedState()
    // Le prêt immo passe à 1 600 € en décembre ; la taxe foncière (1 200 € par an) sort du budget en février.
    state.budgets.push({ ...state.budgets.find((v) => v.categoryId === 'c01')!, from: '2026-12', amount: { kind: 'monthly', value: 1600 } })
    state.budgets.push({ ...state.budgets.find((v) => v.categoryId === 'c10')!, from: '2027-02', amount: { kind: 'none' } })
    state.incomes = []
    const history = budgetHistory(state, '2027-03')
    expect(history.map((p) => p.month)).toEqual(['2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03'])
    expect(history.find((p) => p.month === '2026-11')).toMatchObject({ changed: false })
    expect(history.find((p) => p.month === '2026-12')?.total).toBeCloseTo(3374 + 400, 2)
    expect(history.find((p) => p.month === '2027-02')?.total).toBeCloseTo(3374 + 400 - 1200 / 12, 2)
    expect(history.filter((p) => p.changed).map((p) => p.month)).toEqual(['2026-10', '2026-12', '2027-02'])
  })

  it('est vide sans budget', async () => {
    const { budgetHistory } = await import('./summary')
    const { defaultState } = await import('./state')
    expect(budgetHistory(defaultState(), '2026-10')).toEqual([])
  })
})

describe('incomeHistory', () => {
  it('suit les revenus saisis, mois par mois, et ce qui reste une fois sa part versée', async () => {
    const { incomeHistory, monthSummary } = await import('./summary')
    const state = seedState()
    const [a, b] = state.people
    const history = incomeHistory(state)
    expect(history.map((p) => p.month)).toEqual(['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'])
    // Les revenus importés précèdent le premier budget (octobre 2026) : c'est lui qui s'applique.
    const due = monthSummary(state, '2026-10').due
    for (const point of history) {
      for (const person of [a, b]) {
        const income = point.income[person.id]
        expect(income).toBeGreaterThan(0)
        expect(point.remaining[person.id]).toBeCloseTo((income ?? 0) - due[person.id], 2)
      }
    }
  })

  it('laisse un trou pour un revenu manquant, et suit le budget du mois une fois qu’il existe', async () => {
    const { incomeHistory, monthSummary } = await import('./summary')
    const state = seedState()
    const [a, b] = state.people
    state.incomes = state.incomes.filter((income) => !(income.month === '2026-06' && income.personId === b.id))
    state.incomes.push({ month: '2026-12', personId: a.id, components: [{ amount: 3000 }], updatedAt: 't' })
    state.budgets.push({ ...state.budgets.find((v) => v.categoryId === 'c01')!, from: '2026-12', amount: { kind: 'monthly', value: 1600 } })
    const history = incomeHistory(state)
    const june = history.find((p) => p.month === '2026-06')!
    expect(june.income[b.id]).toBeNull()
    expect(june.remaining[b.id]).toBeNull()
    expect(june.income[a.id]).toBeGreaterThan(0)
    const december = history[history.length - 1]
    expect(december.month).toBe('2026-12')
    expect(december.remaining[a.id]).toBeCloseTo(3000 - monthSummary(state, '2026-12').due[a.id], 2)
    expect(december.income[b.id]).toBeNull()
  })

  it('est vide sans revenu', async () => {
    const { incomeHistory } = await import('./summary')
    const { defaultState } = await import('./state')
    expect(incomeHistory(defaultState())).toEqual([])
  })
})
