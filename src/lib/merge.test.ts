import { describe, expect, it } from 'vitest'
import { seedState } from './fixtures'
import { mergeStates } from './merge'

describe('mergeStates', () => {
  it('garde les deux modifications quand elles portent sur des entités différentes', () => {
    const local = seedState()
    const remote = seedState()
    local.incomes.push({ month: '2026-10', personId: 'p1', components: [{ amount: 2500 }], updatedAt: '2026-10-01T10:00:00Z' })
    remote.budgets[0] = { ...remote.budgets[0], amount: { kind: 'monthly', value: 1600 }, updatedAt: '2026-10-01T11:00:00Z' }

    const merged = mergeStates(local, remote)
    expect(merged.incomes.some((i) => i.month === '2026-10' && i.personId === 'p1')).toBe(true)
    expect(merged.budgets.find((v) => v.categoryId === 'c01')?.amount).toEqual({ kind: 'monthly', value: 1600 })
  })

  it('fait gagner le plus récent sur une même entité', () => {
    const local = seedState()
    const remote = seedState()
    local.incomes[0] = { ...local.incomes[0], components: [{ amount: 1 }], updatedAt: '2026-10-01T12:00:00Z' }
    remote.incomes[0] = { ...remote.incomes[0], components: [{ amount: 2 }], updatedAt: '2026-10-01T11:00:00Z' }
    expect(mergeStates(local, remote).incomes.find((i) => i.month === '2025-10' && i.personId === 'p1')?.components).toEqual([{ amount: 1 }])
    expect(mergeStates(remote, local).incomes.find((i) => i.month === '2025-10' && i.personId === 'p1')?.components).toEqual([{ amount: 1 }])
  })

  it('garde une seule clé prorata et les réglages distants', () => {
    const local = seedState()
    const remote = seedState()
    remote.settings.prorataWindowMonths = 6
    const merged = mergeStates(local, remote)
    expect(merged.splitKeys.filter((k) => k.kind === 'prorata')).toHaveLength(1)
    expect(merged.settings.prorataWindowMonths).toBe(6)
  })

  it('prend en bloc la liste de personnes la plus récemment touchée', () => {
    const local = seedState()
    const remote = seedState()
    local.people = [{ ...local.people[0], name: 'Mel', updatedAt: '2026-10-12T10:00:00Z' }]
    expect(mergeStates(local, remote).people.map((p) => p.name)).toEqual(['Mel'])
    expect(mergeStates(remote, local).people.map((p) => p.name)).toEqual(['Mel'])
  })
})
