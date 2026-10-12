import type { Month } from './types'

/**
 * Toute l'arithmétique des mois tient ici. Un mois est une chaîne `AAAA-MM`, zéro-complétée :
 * les comparer comme des chaînes, c'est les comparer dans le temps.
 */

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

export const TIME_ZONE = 'Europe/Paris'

export function isMonth(value: unknown): value is Month {
  return typeof value === 'string' && MONTH_RE.test(value)
}

/**
 * Le mois courant, celui du couple, pas celui du serveur : un Worker tourne en UTC, et le
 * 1er du mois à 0 h 30 à Paris est encore la veille en UTC.
 */
export function currentMonth(now: Date = new Date()): Month {
  const parts = new Intl.DateTimeFormat('fr-FR', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit' }).formatToParts(now)
  const year = parts.find((part) => part.type === 'year')?.value ?? '1970'
  const month = parts.find((part) => part.type === 'month')?.value ?? '01'
  return `${year}-${month}`
}

export function addMonths(month: Month, count: number): Month {
  const [year, index] = month.split('-').map(Number)
  const total = year * 12 + (index - 1) + count
  const nextYear = Math.floor(total / 12)
  const nextIndex = total - nextYear * 12 + 1
  return `${String(nextYear).padStart(4, '0')}-${String(nextIndex).padStart(2, '0')}`
}

/** Nombre de mois de `from` à `to`, bornes comprises ; négatif si `to` précède `from`. */
export function monthsBetween(from: Month, to: Month): number {
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  return ty * 12 + tm - (fy * 12 + fm) + 1
}

/** Tous les mois de `from` à `to`, bornes comprises, dans l'ordre. */
export function monthRange(from: Month, to: Month): Month[] {
  const months: Month[] = []
  for (let month = from; month <= to; month = addMonths(month, 1)) months.push(month)
  return months
}

const MONTH_NAMES = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]

/** « septembre 2026 ». */
export function monthLabel(month: Month): string {
  const [year, index] = month.split('-')
  return `${MONTH_NAMES[Number(index) - 1] ?? index} ${year}`
}

const SHORT_MONTH_NAMES = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

/** « sept. 2026 », pour les listes serrées. */
export function shortMonthLabel(month: Month): string {
  const [year, index] = month.split('-')
  return `${SHORT_MONTH_NAMES[Number(index) - 1] ?? index} ${year}`
}

/** « d’octobre 2026 », « de septembre 2026 » : le mois après « de », avec son élision. */
export function monthLabelOf(month: Month): string {
  const label = monthLabel(month)
  return /^[aeiouyàâéèêëîïôöûü]/i.test(label) ? `d’${label}` : `de ${label}`
}
