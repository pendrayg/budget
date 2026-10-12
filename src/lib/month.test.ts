import { describe, expect, it } from 'vitest'
import { addMonths, currentMonth, isMonth, monthLabel, monthRange, monthsBetween, shortMonthLabel } from './month'

describe('month', () => {
  it('reconnaît un mois zéro-complété et rien d’autre', () => {
    expect(isMonth('2026-09')).toBe(true)
    expect(isMonth('2026-9')).toBe(false)
    expect(isMonth('2026-13')).toBe(false)
    expect(isMonth(202609)).toBe(false)
  })

  it('calcule le mois courant à Paris, pas en UTC', () => {
    // 31 août 23 h 30 UTC = 1er septembre 01 h 30 à Paris.
    expect(currentMonth(new Date('2026-08-31T23:30:00Z'))).toBe('2026-09')
    expect(currentMonth(new Date('2026-01-01T05:00:00Z'))).toBe('2026-01')
  })

  it('ajoute et retranche des mois en passant les années', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(addMonths('2025-11', 3)).toBe('2026-02')
    expect(addMonths('2026-06', 0)).toBe('2026-06')
  })

  it('énumère un intervalle borné', () => {
    expect(monthRange('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
    expect(monthRange('2026-02', '2026-01')).toEqual([])
    expect(monthsBetween('2025-01', '2025-12')).toBe(12)
  })

  it('libelle en français', () => {
    expect(monthLabel('2026-09')).toBe('septembre 2026')
    expect(shortMonthLabel('2026-09')).toBe('sept. 2026')
    expect(shortMonthLabel('2026-05')).toBe('mai 2026')
    expect(shortMonthLabel('2026-10')).toBe('oct. 2026')
  })
})

describe('monthLabelOf', () => {
  it('élide devant une voyelle', async () => {
    const { monthLabelOf } = await import('./month')
    expect(monthLabelOf('2026-10')).toBe('d’octobre 2026')
    expect(monthLabelOf('2026-04')).toBe('d’avril 2026')
    expect(monthLabelOf('2026-09')).toBe('de septembre 2026')
  })
})
