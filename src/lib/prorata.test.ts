import { describe, expect, it } from 'vitest'
import { seedState } from './fixtures'
import { describeProrata, fixedSharesAt, incomeOf, incomeTotal, prorataAt, prorataHistory, sharesAt, split } from './prorata'
import { defaultState } from './state'

describe('prorataAt', () => {
  it('retrouve le prorata de l’exemple pour le budget d’octobre 2026, sur oct. 2025 – sept. 2026', () => {
    const { shares, averages, months } = prorataAt(seedState(), '2026-10')
    expect(months).toHaveLength(12)
    expect(averages.p1).toBeCloseTo(2145, 3)
    expect(averages.p2).toBeCloseTo(3045.8333, 3)
    expect(shares.p1).toBeCloseTo(0.41323, 4)
    expect(shares.p2).toBeCloseTo(0.58677, 4)
  })

  it('porte sur les douze mois qui précèdent le mois du budget, lui exclu', () => {
    const result = prorataAt(seedState(), '2027-04')
    expect(result.from).toBe('2026-04')
    expect(result.to).toBe('2027-03')
    // Avril à septembre 2026 seulement : octobre 2025 à mars 2026 sont sortis de l’année.
    expect(result.months).toEqual(['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'])
    const sum = (personId: string) => result.months.reduce((total, m) => total + incomeTotal(incomeOf(seedState(), m, personId)), 0)
    const [alice, bruno] = [sum('p1'), sum('p2')]
    expect(alice).toBe(2145 * 3 + 2195 * 3)
    expect(result.averages.p1).toBeCloseTo(alice / 6, 4)
    expect(result.shares.p1).toBeCloseTo(alice / (alice + bruno), 5)
  })

  it('oublie un revenu de plus d’un an, même sans saisie depuis', () => {
    const result = prorataAt(seedState(), '2027-10')
    expect(result.months).toEqual([])
    expect(result.shares).toEqual({ p1: 0.5, p2: 0.5 })
  })

  it('ne moyenne que les mois complets de l’année', () => {
    const state = seedState()
    // Octobre 2026 où seule une personne a saisi : il ne compte pas, et octobre 2025 sort.
    state.incomes.push({ month: '2026-10', personId: 'p1', components: [{ amount: 9000 }], updatedAt: 'x' })
    const result = prorataAt(state, '2026-11')
    expect(result.months).toHaveLength(11)
    expect(result.months[0]).toBe('2025-11')
    expect(result.months.at(-1)).toBe('2026-09')
  })

  it('dit sur quoi il repose', () => {
    expect(describeProrata(prorataAt(seedState(), '2026-10'))).toBe('Revenus d’oct. 2025 – sept. 2026')
    expect(describeProrata(prorataAt(seedState(), '2027-04'))).toBe('Revenus d’avr. 2026 – mars 2027, 6 mois sur 12 saisis')
    expect(describeProrata(prorataAt(seedState(), '2027-09'))).toBe('Revenus de sept. 2026 – août 2027, 1 mois sur 12 saisis')
    expect(describeProrata(prorataAt(seedState(), '2027-10'))).toBe('Aucun revenu complet d’oct. 2026 – sept. 2027 : parts égales')
  })

  it('respecte la durée réglée', () => {
    const state = seedState()
    state.settings.prorataWindowMonths = 1
    const result = prorataAt(state, '2026-10')
    expect(result.months).toEqual(['2026-09'])
    expect(result.shares.p1).toBeCloseTo(2195 / (2195 + 2950), 5)
  })

  it('partage à égalité sans aucun mois complet', () => {
    const result = prorataAt(defaultState(), '2026-01')
    expect(result.months).toEqual([])
    expect(result.shares).toEqual({ p1: 0.5, p2: 0.5 })
  })

  it('ne regarde ni le mois du budget ni ceux d’après', () => {
    const result = prorataAt(seedState(), '2025-12')
    expect(result.months).toEqual(['2025-10', '2025-11'])
  })
})

describe('sharesAt et split', () => {
  it('rend les parts d’une clé fixe, historisées', () => {
    const state = seedState()
    const key = state.splitKeys.find((k) => k.kind === 'fixed')
    if (!key || key.kind !== 'fixed') throw new Error('clé attendue')
    key.shares.push({ from: '2027-01', byPerson: { p1: 0.5, p2: 0.5 } })
    expect(fixedSharesAt(key, '2026-12')).toEqual({ p1: 0.4, p2: 0.6 })
    expect(fixedSharesAt(key, '2027-01')).toEqual({ p1: 0.5, p2: 0.5 })
    expect(sharesAt(state, key.id, '2027-03')).toEqual({ p1: 0.5, p2: 0.5 })
  })

  it('retombe sur le prorata pour une clé inconnue', () => {
    expect(sharesAt(seedState(), 'disparue', '2026-10').p1).toBeCloseTo(0.41323, 4)
  })

  it('répartit une somme comme la calculatrice', () => {
    const parts = split(500, prorataAt(seedState(), '2026-10').shares)
    expect(parts.p1).toBeCloseTo(206.61, 2)
    expect(parts.p2).toBeCloseTo(293.39, 2)
    expect(split(745.2, { p1: 0.3, p2: 0.7 })).toEqual({ p1: 223.56, p2: 521.64 })
  })
})

describe('prorataHistory', () => {
  it('donne un prorata par mois depuis la première saisie', () => {
    const history = prorataHistory(seedState(), '2026-11')
    expect(history).toHaveLength(14)
    expect(history[0].month).toBe('2025-10')
    // Le premier mois saisi ne finance que le budget suivant : le sien n'a encore aucun revenu.
    expect(history[0].prorata.months).toEqual([])
    expect(history[1].prorata.months).toEqual(['2025-10'])
    expect(history.at(-1)?.month).toBe('2026-11')
  })

  it('est vide sans revenu', () => {
    expect(prorataHistory(defaultState(), '2026-02')).toEqual([])
  })
})
