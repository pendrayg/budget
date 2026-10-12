import { addMonths, monthRange, shortMonthLabel } from './month'
import type { Income, Month, Shares, SplitKey, State } from './types'

export function incomeTotal(income: Income | undefined): number {
  return income?.components.reduce((sum, item) => sum + item.amount, 0) ?? 0
}

export function incomeOf(state: State, month: Month, personId: string): Income | undefined {
  return state.incomes.find((income) => income.month === month && income.personId === personId)
}

/** Un mois est complet quand chacun y a un revenu strictement positif. */
export function isCompleteMonth(state: State, month: Month): boolean {
  return state.people.every((person) => incomeTotal(incomeOf(state, month, person.id)) > 0)
}

export interface Prorata {
  /** Part de chaque personne, par identifiant. */
  shares: Shares
  /** Revenu moyen de chaque personne sur les mois retenus. */
  averages: Record<string, number>
  /** Mois complets effectivement moyennés, du plus ancien au plus récent. */
  months: Month[]
  /** L'année glissante qui finance le mois : premier et dernier mois, bornes comprises. */
  from: Month
  to: Month
  /** Sa longueur en mois (douze par défaut). */
  span: number
}

/**
 * La période dont les revenus financent le budget d'un mois : les douze mois du calendrier qui le
 * PRÉCÈDENT, lui exclu. L'argent reçu paie l'argent dépensé : le budget d'octobre 2026 se répartit
 * selon les revenus d'octobre 2025 à septembre 2026, et ceux d'octobre financeront novembre.
 */
export function prorataPeriod(month: Month, span: number): { from: Month; to: Month } {
  return { from: addMonths(month, -span), to: addMonths(month, -1) }
}

/**
 * Le prorata d'un mois : les revenus de chacun sur l'année glissante qui le précède (cf.
 * `prorataPeriod`), et la part de chacun dans leur somme.
 *
 * La période est celle du calendrier, pas « les douze derniers mois saisis » : un revenu de plus
 * d'un an ne compte plus, même si rien n'a été saisi depuis. Dans la période, seuls les mois
 * COMPLETS (tous les revenus saisis) sont moyennés : un mois à moitié rempli fausserait la part
 * de celui qui manque, et un mois vide n'est pas un revenu nul. Le nombre de mois retenus est
 * rendu avec, pour que l'écran le dise.
 *
 * Sans aucun mois complet dans l'année, les parts sont égales : il faut bien répartir, et
 * l'écran le dit.
 */
export function prorataAt(state: State, month: Month): Prorata {
  const span = Math.max(1, Math.floor(state.settings.prorataWindowMonths))
  const { from, to } = prorataPeriod(month, span)
  const months = monthRange(from, to).filter((candidate) => isCompleteMonth(state, candidate))

  const averages: Record<string, number> = {}
  for (const person of state.people) {
    const total = months.reduce((sum, m) => sum + incomeTotal(incomeOf(state, m, person.id)), 0)
    averages[person.id] = months.length > 0 ? total / months.length : 0
  }

  const sum = Object.values(averages).reduce((a, b) => a + b, 0)
  const shares: Shares = {}
  for (const person of state.people) {
    shares[person.id] = sum > 0 ? averages[person.id] / sum : 1 / state.people.length
  }

  return { shares, averages, months, from, to, span }
}

/**
 * « nov. 2025 – oct. 2026 » et, si l'année n'est pas pleine, combien de mois y sont saisis :
 * ce sur quoi repose le prorata affiché.
 */
export function describeProrata(prorata: Prorata): string {
  const first = shortMonthLabel(prorata.from)
  const period = `${/^[aeiouyàâéèêîïôûü]/i.test(first) ? 'd’' : 'de '}${first} – ${shortMonthLabel(prorata.to)}`
  if (prorata.months.length === 0) return `Aucun revenu complet ${period} : parts égales`
  if (prorata.months.length === prorata.span) return `Revenus ${period}`
  return `Revenus ${period}, ${prorata.months.length} mois sur ${prorata.span} saisis`
}

/** Les parts d'une clé fixe à un mois : la dernière version qui ne lui est pas postérieure. */
export function fixedSharesAt(key: Extract<SplitKey, { kind: 'fixed' }>, month: Month): Shares | null {
  const applicable = key.shares.filter((version) => version.from <= month).sort((a, b) => a.from.localeCompare(b.from))
  return applicable.length > 0 ? applicable[applicable.length - 1].byPerson : (key.shares[0]?.byPerson ?? null)
}

export function sharesAt(state: State, splitKeyId: string, month: Month): Shares {
  const key = state.splitKeys.find((candidate) => candidate.id === splitKeyId)
  if (!key || key.kind === 'prorata') return prorataAt(state, month).shares
  const shares = fixedSharesAt(key, month)
  if (shares) return shares
  const equal: Shares = {}
  for (const person of state.people) equal[person.id] = 1 / state.people.length
  return equal
}

export function split(amount: number, shares: Shares): Record<string, number> {
  const result: Record<string, number> = {}
  for (const [personId, share] of Object.entries(shares)) result[personId] = amount * share
  return result
}

/** Le prorata mois par mois, du premier mois saisi au mois demandé : l'historique du ratio. */
export function prorataHistory(state: State, upTo: Month): { month: Month; prorata: Prorata }[] {
  const months = state.incomes.map((income) => income.month).sort()
  if (months.length === 0) return []
  const first = months[0]
  const last = upTo < first ? first : upTo
  return monthRange(first, last).map((month) => ({ month, prorata: prorataAt(state, month) }))
}

export { addMonths }
