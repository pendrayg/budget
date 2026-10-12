import { addMonths, currentMonth, monthRange } from './month'
import { incomeOf, incomeTotal, prorataPeriod } from './prorata'
import type { Month, State } from './types'

/**
 * Les mois échus dont il manque un revenu : du premier mois saisi au mois dernier. Sans aucune
 * saisie, seul le mois dernier est réclamé — on ne demande pas de remonter le temps à qui
 * commence.
 */
export function missingIncomeMonths(state: State, now: Date = new Date()): Month[] {
  const lastMonth = addMonths(currentMonth(now), -1)
  const entered = state.incomes.map((income) => income.month).sort()
  const first = entered[0] && entered[0] < lastMonth ? entered[0] : lastMonth
  return monthRange(first, lastMonth).filter((month) =>
    state.people.some((person) => incomeTotal(incomeOf(state, month, person.id)) <= 0),
  )
}

/**
 * Les mois qui manquent au prorata d'un mois : ceux des douze mois qui le précèdent où un revenu
 * n'est pas saisi, qu'ils soient échus, en cours ou à venir. Le prorata de ce mois se calcule sans
 * eux — et c'est vrai d'un mois futur comme d'un mois passé : regarder le budget de janvier
 * prochain, c'est regarder un prorata qui ne connaît pas encore les revenus d'ici là.
 */
export function missingForProrata(state: State, month: Month): Month[] {
  const span = Math.max(1, Math.floor(state.settings.prorataWindowMonths))
  const { from, to } = prorataPeriod(month, span)
  return monthRange(from, to).filter((candidate) =>
    state.people.some((person) => incomeTotal(incomeOf(state, candidate, person.id)) <= 0),
  )
}
