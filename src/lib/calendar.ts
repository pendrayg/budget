import SCHOOL from './school-holidays.json'
import type { Month, SchoolZone, Weekday } from './types'

/**
 * LE CALENDRIER d'une dépense qui revient certains jours de la semaine — la cantine les lundis,
 * mardis, jeudis et vendredis, sauf jours fériés et vacances scolaires. Son budget d'un mois est son
 * prix d'un jour multiplié par le nombre de ces jours dans le mois : il varie d'un mois à l'autre,
 * et tombe à zéro en août si l'école est fermée.
 *
 * Les jours fériés sont ceux de la France métropolitaine, calculés (Pâques comprise) ; les
 * vacances scolaires, celles de l'Éducation nationale, zone par zone, tirées d'un fichier généré
 * (cf. scripts/school-holidays.mjs), connu jusqu'à `SCHOOL_CALENDAR_UNTIL`.
 */

export const WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7]

/** Leur nom court, celui des boutons, et leur nom entier, celui des lecteurs d'écran. */
export const WEEKDAY_SHORT: Record<Weekday, string> = { 1: 'L', 2: 'M', 3: 'M', 4: 'J', 5: 'V', 6: 'S', 7: 'D' }
export const WEEKDAY_NAMES: Record<Weekday, string> = { 1: 'lundi', 2: 'mardi', 3: 'mercredi', 4: 'jeudi', 5: 'vendredi', 6: 'samedi', 7: 'dimanche' }

export const SCHOOL_ZONES: readonly SchoolZone[] = ['A', 'B', 'C']

/** Le dernier jour dont les vacances scolaires sont publiées. */
export const SCHOOL_CALENDAR_UNTIL: string = SCHOOL.until

/** Les jours d'une dépense : lesquels dans la semaine, et ce qu'on en retire. */
export interface DaySchedule {
  days: Weekday[]
  skipPublicHolidays?: boolean
  skipSchoolHolidays?: boolean
}

const iso = (date: Date) => date.toISOString().slice(0, 10)

/** Le dimanche de Pâques d'une année (algorithme de Meeus, calendrier grégorien). */
export function easter(year: number): string {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return iso(new Date(Date.UTC(year, month - 1, day)))
}

const holidayCache = new Map<number, Set<string>>()

/** Les onze jours fériés de la France métropolitaine d'une année (sans les deux d'Alsace-Moselle). */
export function publicHolidays(year: number): Set<string> {
  const cached = holidayCache.get(year)
  if (cached) return cached
  const sunday = Date.parse(`${easter(year)}T00:00:00Z`)
  const after = (days: number) => iso(new Date(sunday + days * 86_400_000))
  const fixed = ['01-01', '05-01', '05-08', '07-14', '08-15', '11-01', '11-11', '12-25'].map((day) => `${year}-${day}`)
  // Lundi de Pâques, Ascension (jeudi, 39 jours après), lundi de Pentecôte (50 jours après).
  const days = new Set([...fixed, after(1), after(39), after(50)])
  holidayCache.set(year, days)
  return days
}

/** Vrai si la zone est en vacances scolaires ce jour-là. */
export function isSchoolHoliday(date: string, zone: SchoolZone): boolean {
  return (SCHOOL.zones[zone] as Array<[string, string]>).some(([from, to]) => date >= from && date <= to)
}

/**
 * Le nombre de jours d'un mois où la dépense revient. Sans zone, les vacances scolaires ne peuvent
 * pas être retirées : elles comptent comme des jours ordinaires (cf. `scheduleWarning`).
 */
export function scheduledDays(month: Month, schedule: DaySchedule, zone?: SchoolZone): number {
  const [year, monthIndex] = month.split('-').map(Number)
  const length = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate()
  const wanted = new Set(schedule.days)
  const holidays = publicHolidays(year)
  let count = 0
  for (let day = 1; day <= length; day += 1) {
    const date = new Date(Date.UTC(year, monthIndex - 1, day))
    const weekday = (((date.getUTCDay() + 6) % 7) + 1) as Weekday
    if (!wanted.has(weekday)) continue
    const key = iso(date)
    if (schedule.skipPublicHolidays && holidays.has(key)) continue
    if (schedule.skipSchoolHolidays && zone && isSchoolHoliday(key, zone)) continue
    count += 1
  }
  return count
}

/** Ce qui rend le compte d'un mois incertain : pas de zone choisie, ou un calendrier pas encore publié. */
export function scheduleWarning(month: Month, schedule: DaySchedule, zone?: SchoolZone): string | null {
  if (!schedule.skipSchoolHolidays) return null
  if (!zone) return 'Choisissez la zone des vacances scolaires dans les Réglages : sans elle, elles comptent comme des jours d’école.'
  if (`${month}-01` > SCHOOL_CALENDAR_UNTIL) return 'Les vacances scolaires de ce mois ne sont pas encore publiées : elles comptent comme des jours d’école.'
  return null
}

/** « lundi, mardi, jeudi et vendredi » ; « du lundi au vendredi » ; « tous les jours ». */
export function describeDays(days: readonly Weekday[]): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b)
  if (sorted.length === 7) return 'tous les jours'
  if (sorted.length === 5 && sorted.every((day, index) => day === index + 1)) return 'du lundi au vendredi'
  const names = sorted.map((day) => WEEKDAY_NAMES[day])
  return names.length <= 1 ? (names[0] ?? 'aucun jour') : `${names.slice(0, -1).join(', ')} et ${names.at(-1)}`
}
