import { describe, expect, it } from 'vitest'
import { seedState } from './fixtures'
import { missingForProrata, missingIncomeMonths } from './missing'
import { defaultState } from './state'

describe('missingIncomeMonths', () => {
  const now = new Date('2026-12-15T10:00:00Z')

  it('réclame les mois échus non saisis depuis la première saisie', () => {
    expect(missingIncomeMonths(seedState(), now)).toEqual(['2026-10', '2026-11'])
  })

  it('ne réclame que le mois dernier à qui commence', () => {
    expect(missingIncomeMonths(defaultState(), now)).toEqual(['2026-11'])
  })

  it('réclame un mois où une seule personne a saisi, ou un revenu nul', () => {
    const state = seedState()
    state.incomes.push({ month: '2026-10', personId: 'p1', components: [{ amount: 2000 }], updatedAt: 't' })
    state.incomes.push({ month: '2026-11', personId: 'p1', components: [{ amount: 2000 }], updatedAt: 't' })
    state.incomes.push({ month: '2026-11', personId: 'p2', components: [{ amount: 0 }], updatedAt: 't' })
    expect(missingIncomeMonths(state, now)).toEqual(['2026-10', '2026-11'])
  })

  it('ne réclame rien quand tout est saisi', () => {
    const state = seedState()
    for (const month of ['2026-10', '2026-11']) {
      state.incomes.push({ month, personId: 'p1', components: [{ amount: 2000 }], updatedAt: 't' })
      state.incomes.push({ month, personId: 'p2', components: [{ amount: 3000 }], updatedAt: 't' })
    }
    expect(missingIncomeMonths(state, now)).toEqual([])
  })

  it('ne réclame jamais le mois en cours', () => {
    expect(missingIncomeMonths(seedState(), new Date('2026-10-20T10:00:00Z'))).toEqual([])
  })
})

describe('missingForProrata', () => {
  it('ne signale rien quand les douze mois précédents sont complets', () => {
    expect(missingForProrata(seedState(), '2026-10')).toEqual([])
  })

  it('ne compte jamais le mois du budget lui-même', () => {
    const state = seedState()
    state.incomes = state.incomes.filter((income) => income.month !== '2026-09')
    // Septembre 2026 sans revenus ne manque qu'au budget d'octobre, pas à celui de septembre.
    expect(missingForProrata(state, '2026-09')).toEqual(['2025-09'])
    expect(missingForProrata(state, '2026-10')).toEqual(['2026-09'])
  })

  it('signale le mois en cours et les mois à venir qui financent un budget futur', () => {
    expect(missingForProrata(seedState(), '2026-11')).toEqual(['2026-10'])
    expect(missingForProrata(seedState(), '2027-01')).toEqual(['2026-10', '2026-11', '2026-12'])
  })

  it('signale les mois échus qui manquent', () => {
    const state = seedState()
    state.incomes = state.incomes.filter((income) => !(income.month === '2026-03' && income.personId === 'p2'))
    expect(missingForProrata(state, '2026-10')).toEqual(['2026-03'])
    // Le budget de décembre 2025 repose sur décembre 2024 à novembre 2025 : dix mois avant la première saisie.
    expect(missingForProrata(seedState(), '2025-12')).toEqual([
      '2024-12', '2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06', '2025-07', '2025-08', '2025-09',
    ])
  })
})
