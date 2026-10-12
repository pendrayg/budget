import { describe, expect, it } from 'vitest'
import { addCategory, addGroup, budgetAt, createdFrom, deleteCategory, deleteGroup, editCategory, editGroup, isActiveAt, removeVersion, setGroupShares, upsertVersion, versionsOf } from './budget'
import { sharesAt } from './prorata'
import { defaultState } from './state'
import type { BudgetVersion, State } from './types'

function version(from: string, value: number, extra: Partial<BudgetVersion> = {}): BudgetVersion {
  return { categoryId: 'c1', from, groupId: 'g-prorata-monthly', splitKeyId: 'prorata', amount: { kind: 'monthly', value }, save: false, updatedAt: 't', ...extra }
}

function withCategory(): State {
  return addCategory(defaultState(), { id: 'c1', name: 'Eau', updatedAt: 't' }, version('2025-01', 81))
}

describe('versions de budget', () => {
  it('applique la dernière version antérieure ou égale au mois', () => {
    const state = upsertVersion(withCategory(), version('2025-07', 90))
    expect(budgetAt(state, 'c1', '2025-06')?.amount).toEqual({ kind: 'monthly', value: 81 })
    expect(budgetAt(state, 'c1', '2025-07')?.amount).toEqual({ kind: 'monthly', value: 90 })
    expect(budgetAt(state, 'c1', '2026-01')?.amount).toEqual({ kind: 'monthly', value: 90 })
    expect(budgetAt(state, 'c1', '2024-12')).toBeUndefined()
    expect(createdFrom(state, 'c1')).toBe('2025-01')
  })

  it('remplace la version du même mois au lieu de la doubler', () => {
    const state = upsertVersion(upsertVersion(withCategory(), version('2025-07', 90)), version('2025-07', 95))
    expect(versionsOf(state, 'c1').map((v) => v.from)).toEqual(['2025-01', '2025-07'])
    expect(budgetAt(state, 'c1', '2025-08')?.amount).toEqual({ kind: 'monthly', value: 95 })
  })

  it('archive avec une version « plus budgété »', () => {
    const state = upsertVersion(withCategory(), version('2026-01', 0, { amount: { kind: 'none' } }))
    expect(isActiveAt(state, 'c1', '2025-12')).toBe(true)
    expect(isActiveAt(state, 'c1', '2026-01')).toBe(false)
    expect(isActiveAt(state, 'c1', '2024-06')).toBe(false)
  })

  it('retirer une version rend la main à la précédente', () => {
    const state = removeVersion(upsertVersion(withCategory(), version('2025-07', 90)), 'c1', '2025-07')
    expect(budgetAt(state, 'c1', '2025-12')?.amount).toEqual({ kind: 'monthly', value: 81 })
    expect(state.categories).toHaveLength(1)
  })

  it('retirer la seule version retire la catégorie', () => {
    const state = removeVersion(withCategory(), 'c1', '2025-01')
    expect(state.categories).toEqual([])
    expect(state.budgets).toEqual([])
  })

  it('supprimer une catégorie emporte son histoire', () => {
    const state = deleteCategory(upsertVersion(withCategory(), version('2025-07', 90)), 'c1')
    expect(state.budgets).toEqual([])
    expect(state.categories).toEqual([])
  })
})

describe('editCategory', () => {
  it('change le nom et pose, change ou retire l’icône', () => {
    const base: State = { ...defaultState(), categories: [{ id: 'c', name: 'Eau', updatedAt: 't0' }] }
    const withIcon = editCategory(base, 'c', { name: 'Eau', icon: { name: 'md-water', code: 'f058c' } }, 't1')
    expect(withIcon.categories[0]).toEqual({ id: 'c', name: 'Eau', icon: { name: 'md-water', code: 'f058c' }, updatedAt: 't1' })
    const without = editCategory(withIcon, 'c', { name: 'Eau potable' }, 't2')
    expect(without.categories[0]).toEqual({ id: 'c', name: 'Eau potable', updatedAt: 't2' })
  })
})


describe('catégories de l’écran', () => {
  it('crée une catégorie au prorata, ou au ratio avec sa propre clé', () => {
    let state = addGroup(defaultState(), { id: 'g1', name: 'Enfants', save: false, updatedAt: 't' }, null)
    expect(state.groups.at(-1)).toMatchObject({ id: 'g1', splitKeyId: 'prorata' })
    state = addGroup(state, { id: 'g2', name: 'Maison', save: true, updatedAt: 't' }, { p1: 0.4, p2: 0.6 })
    const maison = state.groups.at(-1)!
    expect(maison.splitKeyId).toBe('k-g2')
    expect(sharesAt(state, maison.splitKeyId, '2026-10')).toEqual({ p1: 0.4, p2: 0.6 })
  })

  it('change un ratio à partir d’un mois, sans toucher les mois d’avant', () => {
    let state = addGroup(defaultState(), { id: 'g2', name: 'Maison', save: false, updatedAt: 't' }, { p1: 0.4, p2: 0.6 })
    state = setGroupShares(state, 'g2', '2027-01', { p1: 0.5, p2: 0.5 }, 't2')
    expect(sharesAt(state, 'k-g2', '2026-12')).toEqual({ p1: 0.4, p2: 0.6 })
    expect(sharesAt(state, 'k-g2', '2027-01')).toEqual({ p1: 0.5, p2: 0.5 })
  })

  it('renomme la catégorie et sa clé, et recopie l’épargne dans ses versions', () => {
    let state = addGroup(withCategory(), { id: 'g2', name: 'Maison', save: false, updatedAt: 't' }, { p1: 0.4, p2: 0.6 })
    state = editGroup(state, 'g-prorata-monthly', { name: 'Courant', save: true }, 't2')
    expect(state.groups.find((g) => g.id === 'g-prorata-monthly')).toMatchObject({ name: 'Courant', save: true })
    expect(state.budgets.every((v) => v.save)).toBe(true)
    state = editGroup(state, 'g2', { name: 'Logement', save: false }, 't3')
    expect(state.splitKeys.find((k) => k.id === 'k-g2')).toMatchObject({ name: 'Logement' })
  })

  it('supprime une catégorie avec ses dépenses et sa clé', () => {
    let state = addGroup(withCategory(), { id: 'g2', name: 'Maison', save: false, updatedAt: 't' }, { p1: 0.4, p2: 0.6 })
    state = upsertVersion(addCategory(state, { id: 'c2', name: 'Prêt', updatedAt: 't' }, version('2025-01', 1000, { categoryId: 'c2', groupId: 'g2', splitKeyId: 'k-g2' })), version('2025-01', 81))
    state = deleteGroup(state, 'g2')
    expect(state.groups.some((g) => g.id === 'g2')).toBe(false)
    expect(state.categories.map((c) => c.id)).toEqual(['c1'])
    expect(state.splitKeys.some((k) => k.id === 'k-g2')).toBe(false)
  })
})
