import { createId } from './format'
import { scopePrefix, type Scope } from './scope'
import type { Person, Shares, State } from './types'

/**
 * Les personnes du foyer : de une à quatre. À deux et plus, chacune a son compte et son budget à
 * elle, et il y a le COMMUN, réparti entre elles. Seule, une personne n'a pas de commun : son
 * budget est LE budget, pas de prorata, pas de ratio, pas de sous-menu (`scopeFor`).
 *
 * Ajouter ou retirer quelqu'un touche aux données : une clé fixe donne 0 à l'arrivant ; au
 * départ, ce qui était à la personne est rapatrié — chez celle qui reste s'il n'en reste qu'une
 * (avec le commun), au commun sinon —, ses revenus sont supprimés, et les clés fixes se
 * ramènent aux parts des autres.
 */
export const MAX_PEOPLE = 4

export const isSolo = (state: Pick<State, 'people'>) => state.people.length === 1

/** Le périmètre à montrer : seul, c'est soi ; sinon le choix, s'il désigne quelqu'un, sinon le commun. */
export function scopeFor(state: Pick<State, 'people'>, chosen: Scope): Scope {
  if (isSolo(state)) return state.people[0].id
  return chosen && state.people.some((person) => person.id === chosen) ? chosen : null
}

/** « Alice et Bruno », « Alice, Bruno et Paul ». */
export function peopleNames(people: readonly Person[]): string {
  return new Intl.ListFormat('fr', { style: 'long', type: 'conjunction' }).format(people.map((person) => person.name || 'Sans nom'))
}

/** Ajoute une personne ; chaque clé fixe lui donne 0, les autres gardent leurs parts. */
export function addPerson(state: State, name: string, now: string): State {
  if (state.people.length >= MAX_PEOPLE) return state
  const person: Person = { id: createId(), name, updatedAt: now }
  return {
    ...state,
    people: [...state.people, person],
    splitKeys: state.splitKeys.map((key) =>
      key.kind === 'fixed' ? { ...key, shares: key.shares.map((version) => ({ ...version, byPerson: { ...version.byPerson, [person.id]: 0 } })), updatedAt: now } : key,
    ),
  }
}

/** Les parts des personnes qui restent, ramenées à 1 ; à parts égales s'il ne reste rien. */
function restrict(shares: Shares, ids: string[]): Shares {
  const rest = Object.fromEntries(ids.map((id) => [id, shares[id] ?? 0]))
  const sum = Object.values(rest).reduce((a, b) => a + b, 0)
  return Object.fromEntries(ids.map((id) => [id, sum > 0 ? rest[id] / sum : 1 / ids.length]))
}

/** Un identifiant ou une clé, d'un périmètre à un autre : son préfixe (`p2:`) réécrit. */
const rescope = (id: string, from: Scope, to: Scope) => {
  const prefix = scopePrefix(from)
  return `${scopePrefix(to)}${id.startsWith(prefix) ? id.slice(prefix.length) : id}`
}

/**
 * Retire une personne (jamais la dernière). Ce qui était à elle — catégories, opérations, projets,
 * règles apprises — va à celle qui reste s'il n'en reste qu'une, avec tout le commun ; au commun sinon.
 * Les identifiants suivent (le préfixe du compte), pour qu'un relevé réimporté retrouve ses
 * opérations. Ses revenus disparaissent ; les clés fixes se ramènent aux parts des autres.
 */
export function removePerson(state: State, personId: string, now: string): State {
  if (state.people.length <= 1 || !state.people.some((person) => person.id === personId)) return state
  const people = state.people.filter((person) => person.id !== personId).map((person) => ({ ...person, updatedAt: now }))
  const ids = people.map((person) => person.id)
  const target: Scope = people.length === 1 ? people[0].id : null
  // Les périmètres à rapatrier : la personne retirée, et le commun s'il n'y en a plus.
  const moved: Scope[] = target === null ? [personId] : [personId, null]
  const ownerOf = (owner: string | undefined): Scope => owner ?? null
  const move = <T extends { id: string; owner?: string }>(item: T): T => {
    const from = ownerOf(item.owner)
    if (!moved.includes(from)) return item
    const { owner: _owner, ...rest } = item
    return { ...rest, id: rescope(item.id, from, target), ...(target ? { owner: target } : {}) } as T
  }
  const groups = state.groups.map(move)
  const groupIds = new Map(state.groups.map((group, index) => [group.id, groups[index].id]))
  return {
    ...state,
    people,
    splitKeys: state.splitKeys.map((key) => (key.kind === 'fixed' ? { ...key, shares: key.shares.map((version) => ({ ...version, byPerson: restrict(version.byPerson, ids) })), updatedAt: now } : key)),
    incomes: state.incomes.filter((income) => income.personId !== personId),
    groups,
    budgets: state.budgets.map((version) => ({ ...version, groupId: groupIds.get(version.groupId) ?? version.groupId })),
    transactions: state.transactions.map(move),
    projects: state.projects.map(move),
    rules: dedupe(
      state.rules.map((rule) => {
        const from = scopeOfRule(state, rule.key)
        return moved.includes(from) ? { ...rule, key: rescope(rule.key, from, target), updatedAt: now } : rule
      }),
    ),
  }
}

/** Le compte d'une règle apprise : le préfixe de sa clé, ou le commun. */
const scopeOfRule = (state: Pick<State, 'people'>, key: string): Scope => state.people.find((person) => key.startsWith(scopePrefix(person.id)))?.id ?? null

/** Deux règles rapatriées sur une même clé (un marchand appris des deux côtés) : la plus récente. */
function dedupe<T extends { key: string; updatedAt: string }>(rules: T[]): T[] {
  const byKey = new Map<string, T>()
  for (const rule of rules) {
    const kept = byKey.get(rule.key)
    if (!kept || rule.updatedAt > kept.updatedAt) byKey.set(rule.key, rule)
  }
  return [...byKey.values()]
}
