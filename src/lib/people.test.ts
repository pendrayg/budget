import { describe, expect, it } from 'vitest'
import { addGroup } from './budget'
import { seedState } from './fixtures'
import { addPerson, isSolo, peopleNames, removePerson, scopeFor } from './people'
import { fixedSharesAt } from './prorata'
import { importStatement, placeTransaction } from './spending'
import { sanitizeState } from './state'
import { monthSummary } from './summary'
import type { State } from './types'

const T = '2026-10-12T08:00:00.000Z'
const fixed = (state: State) => state.splitKeys.find((k) => k.kind === 'fixed')!

/** La graine, plus un budget perso de Bruno et une opération sur chaque compte. */
function household(): State {
  let state = addGroup(seedState(), { id: 'p2:g', name: 'Loisirs', save: false, owner: 'p2', updatedAt: T }, null)
  state = { ...state, projects: [...state.projects, { id: 'p2:velo', name: 'Vélo', items: [], owner: 'p2', updatedAt: T }] }
  state = importStatement(state, [{ date: '2026-10-03', label: 'CARTE 02/10/26 SALLE DE SPORT CB*1234', amount: 30 }], T, 'p2').state
  state = placeTransaction(state, state.transactions[0].id, { ignored: true }, T)
  state = importStatement(state, [{ date: '2026-10-04', label: 'CARTE 03/10/26 SUPERMARCHE CB*1234', amount: 41 }], T).state
  return placeTransaction(state, state.transactions[1].id, { categoryId: 'c09' }, T)
}

describe('personnes', () => {
  it('nomme le foyer', () => {
    expect(peopleNames(seedState().people)).toBe('Alice et Bruno')
    expect(peopleNames([...seedState().people, { id: 'x', name: 'Paul', updatedAt: T }])).toBe('Alice, Bruno et Paul')
  })

  it('ajoute une personne, à qui les clés fixes ne donnent rien, jusqu’à quatre', () => {
    let state = addPerson(seedState(), 'Paul', T)
    expect(state.people.map((p) => p.name)).toEqual(['Alice', 'Bruno', 'Paul'])
    const paul = state.people[2].id
    expect(fixedSharesAt(fixed(state), '2026-10')).toEqual({ p1: 0.4, p2: 0.6, [paul]: 0 })
    // Au ratio, rien pour lui ; au prorata, sans revenu saisi, les parts retombent égales (mois incomplets).
    const summary = monthSummary(state, '2026-10')
    expect(summary.sections.find((s) => s.group.name === 'Ratio')!.totals[paul]).toBe(0)
    expect(summary.prorata.shares[paul]).toBeCloseTo(1 / 3, 6)
    state = addPerson(addPerson(state, 'Léa', T), 'Jo', T)
    expect(state.people).toHaveLength(4)
    expect(scopeFor(state, paul)).toBe(paul)
    expect(scopeFor(state, 'disparu')).toBeNull()
  })

  it('retire une personne à trois : son perso devient commun, ses revenus disparaissent, les parts se ramènent à 1', () => {
    const three = addPerson(household(), 'Paul', T)
    const state = removePerson(three, 'p2', T)
    expect(state.people.map((p) => p.name)).toEqual(['Alice', 'Paul'])
    expect(isSolo(state)).toBe(false)
    expect(state.incomes.some((i) => i.personId === 'p2')).toBe(false)
    const loisirs = state.groups.find((g) => g.name === 'Loisirs')!
    expect(loisirs.owner).toBeUndefined()
    expect(loisirs.id).toBe('g')
    expect(state.budgets.every((v) => v.groupId !== 'p2:g')).toBe(true)
    const sport = state.transactions.find((t) => t.label.includes('SALLE'))!
    expect(sport.owner).toBeUndefined()
    expect(sport.id.startsWith('p2:')).toBe(false)
    const velo = state.projects.find((p) => p.name === 'Vélo')!
    expect(velo.id).toBe('velo')
    expect(velo.owner).toBeUndefined()
    expect(state.rules.some((r) => r.key.startsWith('p2:'))).toBe(false)
    expect(state.rules.some((r) => r.key === 'SALLE DE SPORT')).toBe(true)
    expect(fixedSharesAt(fixed(state), '2026-10')).toEqual({ p1: 1, [state.people[1].id]: 0 })
  })

  it('retire une personne à deux : tout, commun compris, va à celle qui reste, et tout est à elle', () => {
    const state = removePerson(household(), 'p2', T)
    expect(isSolo(state)).toBe(true)
    expect(scopeFor(state, null)).toBe('p1')
    expect(state.groups.every((g) => g.owner === 'p1' && g.id.startsWith('p1:'))).toBe(true)
    expect(state.transactions.every((t) => t.owner === 'p1' && t.id.startsWith('p1:'))).toBe(true)
    expect(state.projects.every((p) => p.owner === 'p1' && p.id.startsWith('p1:'))).toBe(true)
    expect(state.rules.every((r) => r.key.startsWith('p1:'))).toBe(true)
    // Le budget commun est devenu le sien : même total, qu'elle paie seule.
    expect(monthSummary(state, '2026-10', 'p1').total).toBeCloseTo(monthSummary(household(), '2026-10').total, 2)
    expect(monthSummary(state, '2026-10', 'p1').due).toEqual({ p1: monthSummary(state, '2026-10', 'p1').total })
    // Un réimport du même relevé n'ajoute rien : les identifiants ont suivi.
    expect(importStatement(state, [{ date: '2026-10-04', label: 'CARTE 03/10/26 SUPERMARCHE CB*1234', amount: 41 }], T, 'p1').duplicates).toBe(1)
    expect(sanitizeState(state)).toEqual(state)
  })

  it('refuse de retirer la dernière personne', () => {
    const solo = removePerson(seedState(), 'p2', T)
    expect(removePerson(solo, 'p1', T)).toBe(solo)
  })
})
