import { describe, expect, it } from 'vitest'
import { describeDays, easter, isSchoolHoliday, publicHolidays, scheduledDays, scheduleWarning, SCHOOL_CALENDAR_UNTIL } from './calendar'
import type { Weekday } from './types'

/** La cantine : lundi, mardi, jeudi, vendredi. */
const CANTINE: Weekday[] = [1, 2, 4, 5]

describe('jours fériés', () => {
  it('calcule Pâques, et les fériés qui en dépendent', () => {
    expect(easter(2026)).toBe('2026-04-05')
    expect(easter(2027)).toBe('2027-03-28')
    const days = publicHolidays(2027)
    // Lundi de Pâques, Ascension, lundi de Pentecôte, et les huit fixes.
    expect(days.has('2027-03-29')).toBe(true)
    expect(days.has('2027-05-06')).toBe(true)
    expect(days.has('2027-05-17')).toBe(true)
    expect(days.has('2027-07-14')).toBe(true)
    expect(days.size).toBe(11)
  })
})

describe('vacances scolaires', () => {
  it('suivent la zone', () => {
    // Hiver 2027 : zone C du 6 au 21 février, zone B du 20 février au 7 mars.
    expect(isSchoolHoliday('2027-02-10', 'C')).toBe(true)
    expect(isSchoolHoliday('2027-02-10', 'B')).toBe(false)
    expect(isSchoolHoliday('2027-03-01', 'B')).toBe(true)
    expect(SCHOOL_CALENDAR_UNTIL).toBe('2028-08-31')
  })
})

describe('scheduledDays', () => {
  it('compte les jours d’un mois où la dépense revient', () => {
    expect(scheduledDays('2026-10', { days: CANTINE })).toBe(18)
  })

  it('retire les vacances scolaires de la zone', () => {
    // Toussaint 2026 : du 17 octobre au 1er novembre.
    expect(scheduledDays('2026-10', { days: CANTINE, skipSchoolHolidays: true }, 'B')).toBe(10)
    // Sans zone, elles ne peuvent pas l'être : le mois compte comme un mois d'école.
    expect(scheduledDays('2026-10', { days: CANTINE, skipSchoolHolidays: true })).toBe(18)
  })

  it('retire les jours fériés, et le pont de l’Ascension avec les vacances', () => {
    expect(scheduledDays('2027-05', { days: CANTINE, skipPublicHolidays: true })).toBe(15)
    expect(scheduledDays('2027-05', { days: CANTINE, skipPublicHolidays: true, skipSchoolHolidays: true }, 'B')).toBe(14)
  })

  it('tombe à zéro en août, école fermée', () => {
    expect(scheduledDays('2027-08', { days: CANTINE, skipSchoolHolidays: true }, 'A')).toBe(0)
  })
})

describe('scheduleWarning', () => {
  it('prévient sans zone, ou au-delà du calendrier publié', () => {
    expect(scheduleWarning('2026-10', { days: CANTINE, skipSchoolHolidays: true })).toMatch(/zone/)
    expect(scheduleWarning('2028-10', { days: CANTINE, skipSchoolHolidays: true }, 'B')).toMatch(/pas encore publiées/)
    expect(scheduleWarning('2026-10', { days: CANTINE, skipSchoolHolidays: true }, 'B')).toBeNull()
    expect(scheduleWarning('2026-10', { days: CANTINE })).toBeNull()
  })
})

describe('describeDays', () => {
  it('dit les jours en clair', () => {
    expect(describeDays(CANTINE)).toBe('lundi, mardi, jeudi et vendredi')
    expect(describeDays([1, 2, 3, 4, 5])).toBe('du lundi au vendredi')
    expect(describeDays([3])).toBe('mercredi')
  })
})
