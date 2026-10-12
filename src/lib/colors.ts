import type { Person, PersonColor } from './types'

/**
 * Les couleurs qu'on peut donner à une personne dans les graphiques : les huit teintes de la
 * palette de référence, chacune avec sa valeur par thème (les variables CSS `--c-<id>`,
 * index.css). Toutes sont proposées, à chacun, sans exclusion : l'aqua, le jaune et
 * le rose sont pâles sur le fond clair (contraste sous 3:1), et certaines paires se distinguent
 * mal (bleu / violet, orange / rouge, et pour un daltonien orange / vert, vert / rouge, rose / aqua)
 * — le choix en revient à chacun.
 */
export const PERSON_COLORS: { id: PersonColor; label: string }[] = [
  { id: 'blue', label: 'Bleu' },
  { id: 'orange', label: 'Orange' },
  { id: 'aqua', label: 'Aqua' },
  { id: 'yellow', label: 'Jaune' },
  { id: 'pink', label: 'Rose' },
  { id: 'green', label: 'Vert' },
  { id: 'violet', label: 'Violet' },
  { id: 'red', label: 'Rouge' },
]

/** Les couleurs par défaut, dans l'ordre des personnes : quatre teintes qui se distinguent. */
export const DEFAULT_COLORS: PersonColor[] = ['blue', 'orange', 'green', 'violet']

export function isPersonColor(value: unknown): value is PersonColor {
  return PERSON_COLORS.some((color) => color.id === value)
}

/** La couleur d'une personne : la sienne, ou celle de son rang. */
export function colorOf(people: readonly Pick<Person, 'color'>[], index: number): PersonColor {
  return people[index]?.color ?? DEFAULT_COLORS[index] ?? 'blue'
}

/** La valeur CSS d'une couleur, qui suit le thème. */
export const colorVar = (color: PersonColor) => `var(--c-${color})`
