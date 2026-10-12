import { describe, expect, it } from 'vitest'
import { colorOf, isPersonColor, PERSON_COLORS } from './colors'

describe('couleurs des personnes', () => {
  it('propose les huit couleurs de la palette', () => {
    expect(PERSON_COLORS.map((color) => color.id)).toEqual(['blue', 'orange', 'aqua', 'yellow', 'pink', 'green', 'violet', 'red'])
    expect(isPersonColor('pink')).toBe(true)
    expect(isPersonColor('#ff00ff')).toBe(false)
  })

  it('donne bleu puis orange à qui n’a pas choisi', () => {
    const people = [{ id: 'a', name: 'A', updatedAt: 't' }, { id: 'b', name: 'B', color: 'green' as const, updatedAt: 't' }]
    expect(colorOf(people, 0)).toBe('blue')
    expect(colorOf(people, 1)).toBe('green')
  })
})
