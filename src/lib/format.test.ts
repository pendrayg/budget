import { describe, expect, it } from 'vitest'
import { formatEuroDelta } from './format'

const plain = (text: string) => text.replace(/\s/g, ' ')

describe('formatEuroDelta', () => {
  it('signe toujours l’écart, avec un vrai signe moins', () => {
    expect(plain(formatEuroDelta(190.36))).toBe('+190,36 €')
    expect(plain(formatEuroDelta(-1234))).toBe('−1 234,00 €')
  })
  it('ne signe pas un écart nul, même arrondi', () => {
    expect(plain(formatEuroDelta(-0.001))).toBe('0,00 €')
  })
})
