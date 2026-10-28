import { describeDays, scheduledDays } from './calendar'
import type { Amount, Month, Period } from './types'

/**
 * Le classeur ramenait chaque dépense au mois à la main : `540/12`, `150/3`, `15+11`.
 * L'application garde la saisie d'origine et fait la division elle-même, pour
 * que le montant reste lisible tel qu'on le connaît (une prime annuelle, un panier de courses).
 */

/** Par combien diviser le montant saisi pour obtenir le mois. */
export const PERIOD_DIVISOR: Record<Period, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
  biennial: 24,
}

export const PERIOD_LABELS: Record<Period, string> = {
  monthly: 'par mois',
  quarterly: 'par trimestre',
  semiannual: 'par semestre',
  annual: 'par an',
  biennial: 'tous les 2 ans',
}

/** Les périodicités, dans l'ordre où le bouton d'un item les fait défiler. */
export const PERIODS: readonly Period[] = ['monthly', 'quarterly', 'semiannual', 'annual', 'biennial']

/** Le nom court d'une périodicité, celui du sélecteur et du bouton d'un item. */
export const PERIOD_SHORT: Record<Period, string> = {
  monthly: 'Mois',
  quarterly: 'Trim.',
  semiannual: 'Sem.',
  annual: 'An',
  biennial: '2 ans',
}

/**
 * Sur combien de mois juger ce qu'on a payé pour une dépense à épargner : l'année glissante, ou
 * deux ans pour un budget sur 2 ans (en tout ou pour l'un de ses items) — payé une fois tous les
 * deux ans, il dépasserait sinon douze fois son mensuel l'année où il tombe.
 */
export function judgedMonths(amount: Amount): number {
  if (amount.kind === 'biennial') return 24
  if (amount.kind === 'items' && amount.items.some((item) => item.period === 'biennial')) return 24
  return 12
}

/**
 * Le budget d'un mois. Chaque item a sa périodicité (mensuelle par défaut) : un abonnement annuel
 * et un mensuel se somment au mois. Un prix par jour se multiplie par le nombre de ses jours dans
 * CE mois (cf. calendar.ts) : il faut le mois.
 */
export function monthlyAmount(amount: Amount, month: Month): number {
  if (amount.kind === 'none') return 0
  if (amount.kind === 'days') return Math.round(amount.value * scheduledDays(month, amount) * 100) / 100
  if (amount.kind === 'items') return amount.items.reduce((sum, item) => sum + item.amount / PERIOD_DIVISOR[item.period ?? 'monthly'], 0)
  return amount.value / PERIOD_DIVISOR[amount.kind]
}

/** « 540,00 € par an » ou « 3 items », ce qui a été saisi, pour la liste. */
export function describeAmount(amount: Amount, formatEuro: (value: number) => string): string {
  if (amount.kind === 'none') return 'plus budgété'
  if (amount.kind === 'items') return `${amount.items.length} ${amount.items.length > 1 ? 'items' : 'item'}`
  if (amount.kind === 'monthly') return ''
  if (amount.kind === 'days') {
    const except = [amount.skipPublicHolidays && 'jours fériés', amount.schoolZone && `vacances zone ${amount.schoolZone}`].filter(Boolean)
    return `${formatEuro(amount.value)} par jour, ${describeDays(amount.days)}${except.length > 0 ? `, sauf ${except.join(' et ')}` : ''}`
  }
  return `${formatEuro(amount.value)} ${PERIOD_LABELS[amount.kind]}`
}
