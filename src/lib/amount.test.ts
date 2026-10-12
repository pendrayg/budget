import { describe, expect, it } from 'vitest'
import { judgedMonths, monthlyAmount } from './amount'

describe('monthlyAmount', () => {
  it('ramène chaque périodicité au mois', () => {
    expect(monthlyAmount({ kind: 'monthly', value: 1200 })).toBeCloseTo(1200)
    expect(monthlyAmount({ kind: 'annual', value: 540 })).toBeCloseTo(45)
    expect(monthlyAmount({ kind: 'quarterly', value: 150 })).toBeCloseTo(50)
  })

  it('somme les items et compte zéro pour « plus budgété »', () => {
    expect(monthlyAmount({ kind: 'items', items: [{ label: 'Films', amount: 15 }, { label: 'Musique', amount: 11 }, { label: 'Jeux', amount: 8.5 }] })).toBeCloseTo(34.5)
    expect(monthlyAmount({ kind: 'none' })).toBe(0)
  })

  it('ramène chaque item au mois selon sa propre périodicité', () => {
    const items = [
      { label: 'Musique', amount: 11 },
      { label: 'Livraison', amount: 69.9, period: 'annual' as const },
      { label: 'Entretien', amount: 90, period: 'quarterly' as const },
    ]
    expect(monthlyAmount({ kind: 'items', items })).toBeCloseTo(11 + 5.825 + 30)
  })
})

describe('budget semestriel', () => {
  it('se ramène au mois sur six mois, en tout ou pour un item, et se juge sur l’année', () => {
    expect(monthlyAmount({ kind: 'semiannual', value: 600 })).toBe(100)
    expect(monthlyAmount({ kind: 'items', items: [{ label: 'Entretien chaudière', amount: 90, period: 'semiannual' }] })).toBe(15)
    expect(judgedMonths({ kind: 'semiannual', value: 600 })).toBe(12)
  })
})

describe('budget sur 2 ans', () => {
  it('se ramène au mois sur vingt-quatre mois, en tout ou pour un item', () => {
    expect(monthlyAmount({ kind: 'biennial', value: 480 })).toBe(20)
    expect(monthlyAmount({ kind: 'items', items: [{ label: 'Contrôle technique', amount: 96, period: 'biennial' }, { label: 'Vignette', amount: 12, period: 'annual' }] })).toBe(5)
  })

  it('se juge sur vingt-quatre mois', () => {
    expect(judgedMonths({ kind: 'biennial', value: 480 })).toBe(24)
    expect(judgedMonths({ kind: 'items', items: [{ label: 'CT', amount: 96, period: 'biennial' }] })).toBe(24)
    expect(judgedMonths({ kind: 'annual', value: 120 })).toBe(12)
  })
})
