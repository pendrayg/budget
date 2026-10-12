import { monthlyAmount } from './amount'
import type { BudgetVersion, Category, CategoryIcon, Month, Shares, State } from './types'

/** Les versions d'une catégorie, de la plus ancienne à la plus récente. */
export function versionsOf(state: State, categoryId: string): BudgetVersion[] {
  return state.budgets.filter((version) => version.categoryId === categoryId).sort((a, b) => a.from.localeCompare(b.from))
}

/**
 * Le budget d'une catégorie à un mois : la dernière version qui ne lui est pas postérieure.
 * `undefined` si la catégorie n'existait pas encore ce mois-là.
 */
export function budgetAt(state: State, categoryId: string, month: Month): BudgetVersion | undefined {
  const applicable = versionsOf(state, categoryId).filter((version) => version.from <= month)
  return applicable[applicable.length - 1]
}

/** Une catégorie est active à un mois si elle y a une version qui n'est pas « plus budgété ». */
export function isActiveAt(state: State, categoryId: string, month: Month): boolean {
  const version = budgetAt(state, categoryId, month)
  return version !== undefined && version.amount.kind !== 'none'
}

/** Le mois de la première version : la naissance de la catégorie. */
export function createdFrom(state: State, categoryId: string): Month | undefined {
  return versionsOf(state, categoryId)[0]?.from
}

/**
 * Pose une version « à partir de `version.from` » : remplace celle du même mois s'il y en a
 * une, sinon s'ajoute. Deux versions ne partagent jamais un mois.
 */
export function upsertVersion(state: State, version: BudgetVersion): State {
  const others = state.budgets.filter((v) => !(v.categoryId === version.categoryId && v.from === version.from))
  return { ...state, budgets: [...others, version] }
}

/**
 * Retire une version : la précédente reprend la main sur les mois qu'elle couvrait. Retirer la
 * seule version d'une catégorie, c'est retirer la catégorie — il n'y a pas de catégorie sans
 * budget, pas même une qui ne dirait rien.
 */
export function removeVersion(state: State, categoryId: string, from: Month): State {
  const remaining = state.budgets.filter((v) => !(v.categoryId === categoryId && v.from === from))
  const stillHasVersions = remaining.some((v) => v.categoryId === categoryId)
  return {
    ...state,
    budgets: remaining,
    categories: stillHasVersions ? state.categories : state.categories.filter((c) => c.id !== categoryId),
  }
}

export function addCategory(state: State, category: Category, first: BudgetVersion): State {
  return upsertVersion({ ...state, categories: [...state.categories, category] }, first)
}

export function renameCategory(state: State, categoryId: string, name: string, updatedAt: string): State {
  return {
    ...state,
    categories: state.categories.map((c) => (c.id === categoryId ? { ...c, name, updatedAt } : c)),
  }
}

/** Change le nom et l'icône d'une catégorie ; `icon` absente, elle n'en a plus. */
export function editCategory(state: State, categoryId: string, changes: { name: string; icon?: CategoryIcon }, updatedAt: string): State {
  return {
    ...state,
    categories: state.categories.map((c) => {
      if (c.id !== categoryId) return c
      const { icon: _previous, ...rest } = c
      return { ...rest, name: changes.name, ...(changes.icon ? { icon: changes.icon } : {}), updatedAt }
    }),
  }
}

/** Supprime une catégorie et toute son histoire. Pour effacer une erreur, pas pour archiver. */
export function deleteCategory(state: State, categoryId: string): State {
  return {
    ...state,
    categories: state.categories.filter((c) => c.id !== categoryId),
    budgets: state.budgets.filter((v) => v.categoryId !== categoryId),
  }
}

/** Le mensuel d'une version, 0 pour une version « plus budgété ». */
export function versionMonthly(version: BudgetVersion): number {
  return monthlyAmount(version.amount)
}

/* ---------- Les catégories de l'écran (`groups`) ---------- */

/** La clé fixe d'une catégorie à ratio : la sienne, à son nom. */
export const groupKeyId = (groupId: string) => `k-${groupId}`

/**
 * Ajoute une catégorie. Au ratio, elle reçoit sa propre clé fixe, valable depuis toujours ; ses
 * parts se changeront ensuite « à partir d'un mois ». Une catégorie personnelle (`owner`) n'a pas
 * de ratio : sa personne paie tout.
 */
export function addGroup(state: State, group: { id: string; name: string; save: boolean; owner?: string; updatedAt: string }, ratio: Shares | null): State {
  if (!ratio) return { ...state, groups: [...state.groups, { ...group, splitKeyId: 'prorata' }] }
  const keyId = groupKeyId(group.id)
  return {
    ...state,
    splitKeys: [...state.splitKeys, { id: keyId, kind: 'fixed', name: group.name, shares: [{ from: '2000-01', byPerson: ratio }], updatedAt: group.updatedAt }],
    groups: [...state.groups, { ...group, splitKeyId: keyId }],
  }
}

/** Change le nom et l'épargne d'une catégorie ; sa clé fixe, si elle en a une, suit son nom. */
export function editGroup(state: State, groupId: string, changes: { name: string; save: boolean }, updatedAt: string): State {
  const group = state.groups.find((g) => g.id === groupId)
  if (!group) return state
  const ownKey = group.splitKeyId !== 'prorata' && !state.groups.some((g) => g.id !== groupId && g.splitKeyId === group.splitKeyId)
  return {
    ...state,
    groups: state.groups.map((g) => (g.id === groupId ? { ...g, ...changes, updatedAt } : g)),
    splitKeys: ownKey ? state.splitKeys.map((k) => (k.id === group.splitKeyId && k.kind === 'fixed' ? { ...k, name: changes.name, updatedAt } : k)) : state.splitKeys,
    // Les copies que lisent les apps d'avant les catégories.
    budgets: state.budgets.map((v) => (v.groupId === groupId ? { ...v, save: changes.save } : v)),
  }
}

/** Les parts d'une catégorie à ratio, à partir d'un mois : les mois d'avant gardent les leurs. */
export function setGroupShares(state: State, groupId: string, from: Month, byPerson: Shares, updatedAt: string): State {
  const group = state.groups.find((g) => g.id === groupId)
  if (!group || group.splitKeyId === 'prorata') return state
  return {
    ...state,
    splitKeys: state.splitKeys.map((k) =>
      k.id === group.splitKeyId && k.kind === 'fixed'
        ? { ...k, shares: [...k.shares.filter((v) => v.from !== from), { from, byPerson }].sort((x, y) => x.from.localeCompare(y.from)), updatedAt }
        : k,
    ),
  }
}

/**
 * Supprime une catégorie, ses dépenses et leur histoire, et sa clé fixe si nulle autre ne s'en
 * sert. Une dépense passée par une autre catégorie y garde ses mois.
 */
export function deleteGroup(state: State, groupId: string): State {
  const group = state.groups.find((g) => g.id === groupId)
  if (!group) return state
  const budgets = state.budgets.filter((v) => v.groupId !== groupId)
  const keyStillUsed = group.splitKeyId === 'prorata' || state.groups.some((g) => g.id !== groupId && g.splitKeyId === group.splitKeyId)
  return {
    ...state,
    groups: state.groups.filter((g) => g.id !== groupId),
    budgets,
    categories: state.categories.filter((c) => budgets.some((v) => v.categoryId === c.id)),
    splitKeys: keyStillUsed ? state.splitKeys : state.splitKeys.filter((k) => k.id !== group.splitKeyId),
  }
}
