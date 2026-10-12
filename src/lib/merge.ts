import type { State } from './types'

/**
 * Fusion de deux états par entité : le plus récent `updatedAt` gagne, entité par entité.
 *
 * Deux téléphones, un document : quand l'un saisit un revenu pendant que l'autre corrige un
 * budget, les deux doivent rester. Un « dernier écrit gagne » sur le document entier perdrait
 * l'un des deux ; par entité, les deux modifications ne se touchent pas et se gardent. Les
 * suppressions ne survivent pas à une fusion, c'est le prix d'une règle simple : une entité
 * absente d'un côté est reprise de l'autre.
 */
export function mergeStates(local: State, remote: State): State {
  const pick = <T extends { updatedAt: string }>(a: T | undefined, b: T | undefined): T =>
    (a && (!b || a.updatedAt >= b.updatedAt) ? a : b) as T

  const byKey = <T extends { updatedAt: string }>(items: T[], key: (item: T) => string): Map<string, T> => {
    const map = new Map<string, T>()
    for (const item of items) map.set(key(item), item)
    return map
  }

  const mergeList = <T extends { updatedAt: string }>(a: T[], b: T[], key: (item: T) => string): T[] => {
    const left = byKey(a, key)
    const right = byKey(b, key)
    const keys = [...new Set([...left.keys(), ...right.keys()])]
    return keys.map((k) => pick(left.get(k), right.get(k)))
  }

  const fixedKeys = mergeList(
    local.splitKeys.filter((key) => key.kind === 'fixed'),
    remote.splitKeys.filter((key) => key.kind === 'fixed'),
    (key) => key.id,
  )

  // Les personnes se fusionnent EN BLOC : ajouter ou retirer quelqu'un déplace ses données
  // (cf. people.ts), et une liste recousue personne par personne les laisserait orphelines. La
  // liste la plus récemment touchée l'emporte ; à égalité le distant, plus souvent à jour. Les
  // réglages n'ont pas d'horodatage : le distant.
  const latest = (people: State['people']) => people.reduce((max, person) => (person.updatedAt > max ? person.updatedAt : max), '')
  const people = latest(local.people) > latest(remote.people) ? local.people : remote.people

  return {
    schema: 1,
    people,
    splitKeys: [{ id: 'prorata', kind: 'prorata' }, ...fixedKeys],
    incomes: mergeList(local.incomes, remote.incomes, (income) => `${income.month}|${income.personId}`),
    // L'ordre des catégories est celui du local, les nouvelles du distant à la suite.
    groups: mergeList(local.groups, remote.groups, (group) => group.id),
    categories: mergeList(local.categories, remote.categories, (category) => category.id),
    budgets: mergeList(local.budgets, remote.budgets, (version) => `${version.categoryId}|${version.from}`),
    projects: mergeList(local.projects, remote.projects, (project) => project.id),
    transactions: mergeList(local.transactions, remote.transactions, (transaction) => transaction.id),
    rules: mergeList(local.rules, remote.rules, (rule) => rule.key),
    settings: remote.settings,
  }
}
