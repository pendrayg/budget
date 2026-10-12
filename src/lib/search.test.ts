import { describe, expect, it } from 'vitest'
import { matchesSearch } from './search'

describe('matchesSearch', () => {
  it('ignore accents et majuscules', () => {
    expect(matchesSearch('Électricité', 'elec')).toBe(true)
    expect(matchesSearch('Courses', 'COUR')).toBe(true)
  })
  it('demande chaque mot, dans n’importe quel ordre', () => {
    expect(matchesSearch('Assurance maison', 'maison assu')).toBe(true)
    expect(matchesSearch('Assurance voiture', 'maison assu')).toBe(false)
  })
  it('garde tout pour une recherche vide', () => {
    expect(matchesSearch('Courses', '  ')).toBe(true)
  })
})
