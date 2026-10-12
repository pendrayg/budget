import { describe, expect, it } from 'vitest'
import { appHeight } from './viewport'

// iPhone 17 Pro : 402 × 874 points ; en web app, iOS rend 100dvh à 874 − 62 = 812.
const iphone = { screenWidth: 402, screenHeight: 874, innerHeight: 812 }

describe('appHeight', () => {
  it('laisse 100dvh faire dans Safari', () => {
    expect(appHeight({ ...iphone, standalone: false, landscape: false })).toBeNull()
  })

  it('prend toute la hauteur de l’écran en web app', () => {
    expect(appHeight({ ...iphone, standalone: true, landscape: false })).toBe(874)
  })

  it('prend la petite dimension en paysage, `screen` ne pivotant pas sur iOS', () => {
    expect(appHeight({ ...iphone, innerHeight: 380, standalone: true, landscape: true })).toBe(402)
  })

  it('ne rogne jamais ce que le navigateur donne déjà', () => {
    expect(appHeight({ ...iphone, innerHeight: 900, standalone: true, landscape: false })).toBe(900)
  })

  it('ignore un écran aux dimensions inconnues', () => {
    expect(appHeight({ screenWidth: 0, screenHeight: 0, innerHeight: 800, standalone: true, landscape: false })).toBeNull()
  })
})
