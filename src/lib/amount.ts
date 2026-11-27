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
 * Comment juger ce qu'on a payé pour une dépense à épargner : sa période (3, 6, 12, 24 mois ; la
 * plus longue de ses items) pour une dépense PÉRIODIQUE, jugée en enveloppe (cf. `periodAllowance`
 * et `spendingSummary`) ; `null` pour un montant au mois (ou par jour), jugé sur sa durée comme
 * l'épargne d'un projet.
 */
export function judgedMonths(amount: Amount): number | null {
  if (amount.kind === 'items') {
    const longest = Math.max(...amount.items.map((item) => PERIOD_DIVISOR[item.period ?? 'monthly']))
    return longest > 1 ? longest : null
  }
  if (amount.kind === 'monthly' || amount.kind === 'days' || amount.kind === 'none') return null
  return PERIOD_DIVISOR[amount.kind]
}

/**
 * Ce qu'une dépense à épargner apporte à son enveloppe le `index`-ième mois depuis qu'on la suit
 * (0 le premier) : son montant au début de chacune de ses périodes — tous les six mois pour un
 * semestriel, chaque item à son rythme —, son prix du mois pour un montant au mois ou par jour.
 */
export function periodAllowance(amount: Amount, index: number, month: Month): number {
  if (amount.kind === 'none') return 0
  if (amount.kind === 'days') return monthlyAmount(amount, month)
  if (amount.kind === 'items') return amount.items.reduce((sum, item) => sum + (index % PERIOD_DIVISOR[item.period ?? 'monthly'] === 0 ? item.amount : 0), 0)
  return index % PERIOD_DIVISOR[amount.kind] === 0 ? amount.value : 0
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
    const during = amount.schoolZone && amount.duringSchoolHolidays ? `, pendant les vacances zone ${amount.schoolZone}` : ''
    const except = [amount.skipPublicHolidays && 'jours fériés', !during && amount.schoolZone && `vacances zone ${amount.schoolZone}`].filter(Boolean)
    return `${formatEuro(amount.value)} par jour, ${describeDays(amount.days)}${during}${except.length > 0 ? `, sauf ${except.join(' et ')}` : ''}`
  }
  return `${formatEuro(amount.value)} ${PERIOD_LABELS[amount.kind]}`
}
