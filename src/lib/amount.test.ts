import { describe, expect, it } from 'vitest'
import { describeAmount, judgedMonths, monthlyAmount } from './amount'

describe('monthlyAmount', () => {
  it('ramène chaque périodicité au mois', () => {
    expect(monthlyAmount({ kind: 'monthly', value: 1200 }, '2026-10')).toBeCloseTo(1200)
    expect(monthlyAmount({ kind: 'annual', value: 540 }, '2026-10')).toBeCloseTo(45)
    expect(monthlyAmount({ kind: 'quarterly', value: 150 }, '2026-10')).toBeCloseTo(50)
  })

  it('somme les items et compte zéro pour « plus budgété »', () => {
    expect(monthlyAmount({ kind: 'items', items: [{ label: 'Films', amount: 15 }, { label: 'Musique', amount: 11 }, { label: 'Jeux', amount: 8.5 }] }, '2026-10')).toBeCloseTo(34.5)
    expect(monthlyAmount({ kind: 'none' }, '2026-10')).toBe(0)
  })

  it('ramène chaque item au mois selon sa propre périodicité', () => {
    const items = [
      { label: 'Musique', amount: 11 },
      { label: 'Livraison', amount: 69.9, period: 'annual' as const },
      { label: 'Entretien', amount: 90, period: 'quarterly' as const },
    ]
    expect(monthlyAmount({ kind: 'items', items }, '2026-10')).toBeCloseTo(11 + 5.825 + 30)
  })
})

describe('budget semestriel', () => {
  it('se ramène au mois sur six mois, en tout ou pour un item, et se juge sur l’année', () => {
    expect(monthlyAmount({ kind: 'semiannual', value: 600 }, '2026-10')).toBe(100)
    expect(monthlyAmount({ kind: 'items', items: [{ label: 'Entretien chaudière', amount: 90, period: 'semiannual' }] }, '2026-10')).toBe(15)
    expect(judgedMonths({ kind: 'semiannual', value: 600 })).toBe(12)
  })
})

describe('budget sur 2 ans', () => {
  it('se ramène au mois sur vingt-quatre mois, en tout ou pour un item', () => {
    expect(monthlyAmount({ kind: 'biennial', value: 480 }, '2026-10')).toBe(20)
    expect(monthlyAmount({ kind: 'items', items: [{ label: 'Contrôle technique', amount: 96, period: 'biennial' }, { label: 'Vignette', amount: 12, period: 'annual' }] }, '2026-10')).toBe(5)
  })

  it('se juge sur vingt-quatre mois', () => {
    expect(judgedMonths({ kind: 'biennial', value: 480 })).toBe(24)
    expect(judgedMonths({ kind: 'items', items: [{ label: 'CT', amount: 96, period: 'biennial' }] })).toBe(24)
    expect(judgedMonths({ kind: 'annual', value: 120 })).toBe(12)
  })
})

describe('prix par jour', () => {
  const cantine = { kind: 'days' as const, value: 4.5, days: [1, 2, 4, 5] as (1 | 2 | 4 | 5)[], skipPublicHolidays: true, schoolZone: 'B' as const }

  it('se multiplie par le nombre de ses jours dans le mois', () => {
    // Octobre 2026, zone B : dix jours de cantine avant la Toussaint.
    expect(monthlyAmount(cantine, '2026-10')).toBe(45)
    expect(monthlyAmount(cantine, '2027-08')).toBe(0)
  })

  it('se décrit en clair', () => {
    expect(describeAmount(cantine, (value) => `${value} €`)).toBe('4.5 € par jour, lundi, mardi, jeudi et vendredi, sauf jours fériés et vacances zone B')
  })
})
