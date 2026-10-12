import { describe, expect, it } from 'vitest'
import { budgetAt } from './budget'
import { seedState } from './fixtures'
import { activateProject, deleteProject, isProjectSaving, projectSaved, stopProject, syncProjectBudget } from './projects'
import { addGroup } from './budget'
import { importStatement, placeTransaction, spendingSummary } from './spending'
import { sanitizeState } from './state'
import { monthSummary } from './summary'
import type { State } from './types'

const T = '2026-10-01T08:00:00.000Z'
const SAVE = 'g-prorata-save'

/** La graine et un vélo de 391 €, visé pour mars 2027. */
function withProject(target = '2027-03'): State {
  const state = seedState()
  return { ...state, projects: [...state.projects, { id: 'nas', name: 'Vélo', items: [{ id: 'a', label: 'Vélo', amount: 330 }, { id: 'b', label: 'Casque', amount: 61 }], target, updatedAt: T }] }
}

const project = (state: State) => state.projects.find((p) => p.id === 'nas')!

/** Range un virement vers l'épargne d'octobre, à `ratio` du « à épargner » du mois. */
function transfer(state: State, month: string, ratio: number): State {
  const toSave = spendingSummary(state, month).savings.toSave
  const imported = importStatement(state, [{ date: `${month}-10`, label: 'VIR Mensualisation epargne', amount: Math.round(toSave * ratio * 100) / 100 }], T).state
  const id = imported.transactions.find((t) => t.date === `${month}-10`)!.id
  return placeTransaction(imported, id, { saving: true }, T)
}

describe('projets épargnés', () => {
  it('devient une dépense à épargner dont la mensualité mène le total à la cible, puis s’arrête', () => {
    const state = activateProject(withProject(), 'nas', SAVE, '2026-10', 'c-nas', T)
    const id = project(state).budget!.categoryId
    expect(id).toBe('c-nas')
    // 391 € sur six mois, d'octobre à mars.
    expect(budgetAt(state, id, '2026-10')?.amount).toEqual({ kind: 'monthly', value: 65.17 })
    expect(budgetAt(state, id, '2027-04')?.amount).toEqual({ kind: 'none' })
    expect(monthSummary(state, '2026-10').total).toBeCloseTo(monthSummary(seedState(), '2026-10').total + 65.17, 2)
    expect(isProjectSaving(state, project(state), '2027-03')).toBe(true)
    expect(isProjectSaving(state, project(state), '2027-04')).toBe(false)
  })

  it('s’épargne aussi dans un budget perso, sous le préfixe de sa personne', () => {
    let state = addGroup(withProject(), { id: 'p2:g', name: 'Épargne', save: true, owner: 'p2', updatedAt: T }, null)
    state = activateProject(state, 'nas', 'p2:g', '2026-10', 'c-nas', T)
    expect(project(state).budget?.categoryId).toBe('p2:c-nas')
    expect(monthSummary(state, '2026-10', 'p2').total).toBeCloseTo(65.17, 2)
    expect(monthSummary(state, '2026-10').total).toBeCloseTo(monthSummary(seedState(), '2026-10').total, 2)
  })

  it('suit l’épargne réellement versée, mois importé par mois importé', () => {
    const active = activateProject(withProject(), 'nas', SAVE, '2026-10', 'c-nas', T)
    expect(projectSaved(transfer(active, '2026-10', 1), project(active), '2026-10')).toBeCloseTo(65.17, 2)
    expect(projectSaved(transfer(active, '2026-10', 0.5), project(active), '2026-10')).toBeCloseTo(32.59, 1)
    // Verser plus que prévu ne compte pas double ; un mois non importé ne compte pas.
    expect(projectSaved(transfer(active, '2026-10', 2), project(active), '2026-11')).toBeCloseTo(65.17, 2)
  })

  it('recalcule la mensualité sur le reste quand le projet change', () => {
    let state = transfer(activateProject(withProject(), 'nas', SAVE, '2026-10', 'c-nas', T), '2026-10', 1)
    state = { ...state, projects: state.projects.map((p) => (p.id === 'nas' ? { ...p, items: [{ id: 'a', label: 'NAS', amount: 600 }] } : p)) }
    state = syncProjectBudget(state, 'nas', '2026-11', T)
    // (600 − 65,17) sur cinq mois, de novembre à mars ; octobre garde la sienne.
    expect(budgetAt(state, 'c-nas', '2026-11')?.amount).toEqual({ kind: 'monthly', value: 106.97 })
    expect(budgetAt(state, 'c-nas', '2026-10')?.amount).toEqual({ kind: 'monthly', value: 65.17 })
    // Une cible repoussée déplace l'arrêt.
    state = syncProjectBudget({ ...state, projects: state.projects.map((p) => (p.id === 'nas' ? { ...p, target: '2027-06' } : p)) }, 'nas', '2026-11', T)
    expect(budgetAt(state, 'c-nas', '2027-04')?.amount.kind).toBe('monthly')
    expect(budgetAt(state, 'c-nas', '2027-07')?.amount).toEqual({ kind: 'none' })
  })

  it('s’arrête et se supprime sans effacer l’histoire du budget', () => {
    const active = activateProject(withProject(), 'nas', SAVE, '2026-10', 'c-nas', T)
    const stopped = stopProject(active, 'nas', '2026-12', T)
    expect(budgetAt(stopped, 'c-nas', '2026-11')?.amount.kind).toBe('monthly')
    expect(budgetAt(stopped, 'c-nas', '2026-12')?.amount).toEqual({ kind: 'none' })
    expect(project(stopped).budget?.categoryId).toBe('c-nas')
    const deleted = deleteProject(active, 'nas', '2026-12', T)
    expect(deleted.projects.some((p) => p.id === 'nas')).toBe(false)
    expect(budgetAt(deleted, 'c-nas', '2026-12')?.amount).toEqual({ kind: 'none' })
  })

  it('ne compte pas en dépassement l’achat payé après la cible', () => {
    let state = activateProject(withProject('2026-12'), 'nas', SAVE, '2026-10', 'c-nas', T)
    state = importStatement(state, [{ date: '2027-01-15', label: 'CARTE 14/01/27 BOUTIQUE NAS CB*1234', amount: 391 }], T).state
    state = placeTransaction(state, state.transactions.at(-1)!.id, { categoryId: 'c-nas' }, T)
    const line = spendingSummary(state, '2027-01').savings.sections.flatMap((s) => s.lines).find((l) => l.category.id === 'c-nas')!
    expect(line.spent).toBe(391)
    expect(line.over).toBe(false)
  })

  it('garde la cible et le lien à l’assainissement, et oublie un lien vers une dépense disparue', () => {
    const state = activateProject(withProject(), 'nas', SAVE, '2026-10', 'c-nas', T)
    expect(project(sanitizeState(state))).toMatchObject({ target: '2027-03', budget: { categoryId: 'c-nas' } })
    const broken = { ...state, projects: state.projects.map((p) => (p.id === 'nas' ? { ...p, budget: { categoryId: 'disparue' } } : p)) }
    expect(project(sanitizeState(broken)).budget).toBeUndefined()
  })
})
