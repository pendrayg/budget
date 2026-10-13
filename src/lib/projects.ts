import { addCategory, budgetAt, editCategory, upsertVersion, versionMonthly, versionsOf } from './budget'
import { addMonths, monthsBetween } from './month'
import { categoryScope, inScope, scopePrefix } from './scope'
import { spendingMonths, spendingSummary } from './spending'
import type { Amount, BudgetGroup, BudgetVersion, CategoryIcon, Month, Project, State } from './types'

/**
 * Un projet qu'on ÉPARGNE : avec une date cible, il devient une dépense d'une catégorie à épargner
 * de son périmètre (un projet du commun dans le commun, celui d'une personne dans son budget), dont la mensualité mène son total à la cible. C'est une dépense
 * comme une autre — historique, synthèses, rangement des opérations, bloc Épargne des dépenses —
 * que le projet désigne (`project.budget`). Le lien reste quand on arrête ou que la cible passe :
 * la complétion se lit toujours.
 *
 * La mensualité est le RESTE à épargner, divisé par les mois restants jusqu'à la cible (le mois en
 * cours compris) ; elle se recalcule à chaque modification du projet, à partir du mois en cours,
 * et s'arrête après la cible. La complétion est l'épargne RÉALISÉE : chaque mois importé, la
 * mensualité du projet au prorata du versement vers l'épargne de ce mois-là (versé / à épargner,
 * plafonné à 100 %) ; un mois pas encore importé ne compte pas.
 */

/** L'icône de TOUS les projets, devant celle qu'on leur choisit : une grue, quelque chose se construit. */
export const PROJECT_ICON: CategoryIcon = { name: 'md-crane', code: 'f0862' }

/** Les dépenses du budget qui épargnent un projet : leur ligne porte aussi la grue des projets. */
export function projectCategoryIds(state: State): Set<string> {
  return new Set(state.projects.flatMap((project) => (project.budget ? [project.budget.categoryId] : [])))
}

export function projectTotal(project: Project): number {
  return project.items.reduce((sum, item) => sum + item.amount, 0)
}

const cents = (value: number) => Math.round(value * 100) / 100

/** La mensualité qui mène le reste à la cible : le mois `from` et la cible compris. */
export function projectMonthly(total: number, saved: number, from: Month, target: Month): number {
  return cents(Math.max(0, total - saved) / Math.max(1, monthsBetween(from, target)))
}

/** L'épargne réalisée pour un projet, des mois importés jusqu'à `upTo` compris. */
export function projectSaved(state: State, project: Project, upTo: Month): number {
  const categoryId = project.budget?.categoryId
  const first = categoryId ? versionsOf(state, categoryId)[0] : undefined
  if (!categoryId || !first) return 0
  const scope = categoryScope(state, categoryId)
  const imported = new Set(spendingMonths(state, scope))
  let saved = 0
  for (let month = first.from; month <= upTo; month = addMonths(month, 1)) {
    if (!imported.has(month)) continue
    const version = budgetAt(state, categoryId, month)
    const monthly = version ? versionMonthly(version) : 0
    if (monthly <= 0) continue
    const { transferred, toSave } = spendingSummary(state, month, scope).savings
    if (toSave > 0) saved += monthly * Math.min(1, Math.max(0, transferred) / toSave)
  }
  return cents(saved)
}

/** On l'épargne ce mois-ci : sa dépense y a une mensualité. */
export function isProjectSaving(state: State, project: Project, month: Month): boolean {
  const version = project.budget ? budgetAt(state, project.budget.categoryId, month) : undefined
  return version !== undefined && version.amount.kind !== 'none'
}

/** La catégorie où le projet s'épargne : celle de la dernière version de sa dépense. */
export function projectGroup(state: State, project: Project): BudgetGroup | undefined {
  const groupId = project.budget ? versionsOf(state, project.budget.categoryId).at(-1)?.groupId : undefined
  return state.groups.find((group) => group.id === groupId)
}

function version(categoryId: string, from: Month, group: BudgetGroup, amount: Amount, updatedAt: string): BudgetVersion {
  // La répartition et l'épargne de la catégorie, copiées pour les apps d'avant (cf. CategoryForm).
  return { categoryId, from, groupId: group.id, splitKeyId: group.splitKeyId, amount, save: group.save, updatedAt }
}

/** Retire les versions d'une dépense postérieures à `month` : le calendrier repart de ce mois. */
function dropAfter(state: State, categoryId: string, month: Month): State {
  return { ...state, budgets: state.budgets.filter((v) => !(v.categoryId === categoryId && v.from > month)) }
}

/**
 * Commence à épargner un projet dans une catégorie à épargner, à partir de `month` : sa dépense
 * naît (identifiant `categoryId`, préfixé du propriétaire de la catégorie), avec sa mensualité
 * jusqu'à la cible. Un projet déjà lié reprend sa dépense (cf. `syncProjectBudget`).
 */
export function activateProject(state: State, projectId: string, groupId: string, month: Month, categoryId: string, now: string): State {
  const project = state.projects.find((p) => p.id === projectId)
  const group = state.groups.find((g) => g.id === groupId)
  if (!project?.target || !group || !inScope(group, project.owner ?? null)) return state
  if (project.budget) return syncProjectBudget(state, projectId, month, now)
  const id = `${scopePrefix(group.owner ?? null)}${categoryId}`
  const monthly = projectMonthly(projectTotal(project), 0, month, project.target)
  let next = addCategory(state, { id, name: project.name, ...(project.icon ? { icon: project.icon } : {}), updatedAt: now }, version(id, month, group, { kind: 'monthly', value: monthly }, now))
  next = upsertVersion(next, version(id, addMonths(project.target, 1), group, { kind: 'none' }, now))
  return { ...next, projects: next.projects.map((p) => (p.id === projectId ? { ...p, budget: { categoryId: id }, updatedAt: now } : p)) }
}

/**
 * Recale la dépense d'un projet sur le projet, à partir de `month` : son nom et son icône, et la mensualité qui
 * mène le reste (total moins l'épargne réalisée avant ce mois) à la cible, arrêtée après elle. Une
 * cible passée, ou retirée, arrête l'épargne.
 */
export function syncProjectBudget(state: State, projectId: string, month: Month, now: string): State {
  const project = state.projects.find((p) => p.id === projectId)
  const group = project ? projectGroup(state, project) : undefined
  if (!project?.budget || !group) return state
  const id = project.budget.categoryId
  const category = state.categories.find((c) => c.id === id)
  const renamed = category && (category.name !== project.name || category.icon?.name !== project.icon?.name)
  let next = renamed ? editCategory(state, id, { name: project.name, icon: project.icon }, now) : state
  next = dropAfter(next, id, month)
  if (!project.target || project.target < month) return upsertVersion(next, version(id, month, group, { kind: 'none' }, now))
  const monthly = projectMonthly(projectTotal(project), projectSaved(state, project, addMonths(month, -1)), month, project.target)
  next = upsertVersion(next, version(id, month, group, { kind: 'monthly', value: monthly }, now))
  return upsertVersion(next, version(id, addMonths(project.target, 1), group, { kind: 'none' }, now))
}

/** Arrête d'épargner un projet à partir de `month`. Sa dépense garde son histoire, le lien reste. */
export function stopProject(state: State, projectId: string, month: Month, now: string): State {
  const project = state.projects.find((p) => p.id === projectId)
  const group = project ? projectGroup(state, project) : undefined
  if (!project?.budget || !group) return state
  const id = project.budget.categoryId
  return upsertVersion(dropAfter(state, id, month), version(id, month, group, { kind: 'none' }, now))
}

/** Supprime un projet ; s'il s'épargnait, sa dépense s'arrête d'abord (son histoire reste au budget). */
export function deleteProject(state: State, projectId: string, month: Month, now: string): State {
  const project = state.projects.find((p) => p.id === projectId)
  const next = project && isProjectSaving(state, project, month) ? stopProject(state, projectId, month, now) : state
  return { ...next, projects: next.projects.filter((p) => p.id !== projectId) }
}
