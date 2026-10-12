import { versionsOf } from './budget'
import type { BudgetGroup, Category, State } from './types'

/**
 * À qui sont un budget et des dépenses : au COMMUN (`null`), ou à l'une des personnes (son
 * identifiant). Une catégorie personnelle n'a pas de répartition : sa personne paie tout ; une
 * opération personnelle vient du relevé de son compte à elle, importé sous son nom.
 *
 * Le propriétaire est un champ (`owner`), ET le préfixe de l'identifiant (« p2:… ») : les apps
 * d'avant, qui ne connaissent pas le champ, le perdent en réécrivant l'entité, jamais
 * l'identifiant — l'assainissement l'y retrouve. Les règles apprises, elles, n'ont que leur clé :
 * préfixée de même, chaque compte apprend ses propres marchands.
 */
export type Scope = string | null

/** Le préfixe des identifiants et des clés d'un périmètre : « p2: », rien pour le commun. */
export const scopePrefix = (scope: Scope) => (scope ? `${scope}:` : '')

/** Le propriétaire qu'un identifiant porte en préfixe, parmi les personnes ; `null` sinon. */
export function ownerFromId(id: string, personIds: readonly string[]): Scope {
  return personIds.find((personId) => id.startsWith(`${personId}:`)) ?? null
}

export const inScope = (item: { owner?: string }, scope: Scope) => (item.owner ?? null) === scope

export function groupsOf(state: State, scope: Scope): BudgetGroup[] {
  return state.groups.filter((group) => inScope(group, scope))
}

/** Le périmètre d'une dépense : celui de la catégorie de sa dernière version. */
export function categoryScope(state: State, categoryId: string): Scope {
  const groupId = versionsOf(state, categoryId).at(-1)?.groupId
  return state.groups.find((group) => group.id === groupId)?.owner ?? null
}

export function categoriesOf(state: State, scope: Scope): Category[] {
  return state.categories.filter((category) => categoryScope(state, category.id) === scope)
}
