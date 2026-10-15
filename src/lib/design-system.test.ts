// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { DESIGN_SYSTEM_KEY, readDesignSystem, writeDesignSystem } from './design-system'

beforeEach(() => {
  localStorage.clear()
})

describe('design-system', () => {
  it('habille l’application du néomorphique par défaut', () => {
    expect(readDesignSystem()).toBe('neomorphism')
  })

  it('retient le choix sur l’appareil', () => {
    writeDesignSystem('star-wars')
    expect(localStorage.getItem(DESIGN_SYSTEM_KEY)).toBe('star-wars')
    expect(readDesignSystem()).toBe('star-wars')
  })

  it('reprend le défaut devant une valeur inconnue', () => {
    localStorage.setItem(DESIGN_SYSTEM_KEY, 'brutalism')
    expect(readDesignSystem()).toBe('neomorphism')
    writeDesignSystem('cyberpunk' as never)
    expect(localStorage.getItem(DESIGN_SYSTEM_KEY)).toBe('brutalism')
  })
})
