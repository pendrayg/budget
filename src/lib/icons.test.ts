import { describe, expect, it } from 'vitest'
import icons from './nerd-icons.json'
import { APP_ICON_LIST, appIconOf, glyph, iconLabel, searchIcons, SUGGESTED, type NerdIcon } from './icons'

// Comme le sélecteur : les icônes de l'app devant celles de Nerd Fonts.
const all = [...APP_ICON_LIST, ...(icons as NerdIcon[])]

describe('icônes Nerd Font', () => {
  it('les a toutes, avec leur point de code', () => {
    expect(all.length).toBeGreaterThan(10000)
    expect(all.find(([name]) => name === 'md-home')?.[1]).toBe('f02dc')
  })

  it('propose les icônes du ménage avant toute recherche', () => {
    const suggestions = searchIcons(all, '  ')
    expect(suggestions.map(([name]) => name)).toEqual(SUGGESTED)
  })

  it('cherche en anglais, chaque mot dans le nom, Material Design d’abord', () => {
    const results = searchIcons(all, 'gas station')
    expect(results[0][0]).toBe('md-gas_station')
    expect(results.every(([name]) => name.includes('gas') && name.includes('station'))).toBe(true)
  })

  it('comprend les mots du budget en français, accents compris', () => {
    expect(searchIcons(all, 'électricité').some(([name]) => name === 'md-flash')).toBe(true)
    expect(searchIcons(all, 'voiture').some(([name]) => name === 'md-car')).toBe(true)
  })

  it('donne le caractère d’une icône', () => {
    expect(glyph({ name: 'md-home', code: 'f02dc' })).toBe(String.fromCodePoint(0xf02dc))
  })
})

describe('icônes dessinées par l’app', () => {
  it('trouve le drapeau breton en français comme en anglais, devant les drapeaux de Nerd Fonts', () => {
    for (const query of ['bretagne', 'Breton', 'breizh', 'gwenn', 'drapeau', 'flag']) {
      expect(searchIcons(all, query)[0][0]).toBe('app-gwenn_ha_du')
    }
    expect(searchIcons(all, 'drapeau').some(([name]) => name === 'md-flag')).toBe(true)
    expect(SUGGESTED.slice(0, 2)).toEqual(['app-gwenn_ha_du', 'app-triskel'])
  })

  it('trouve le triskel, et les deux icônes bretonnes ensemble', () => {
    for (const query of ['triskel', 'triskèle', 'celtique', 'spirale']) {
      expect(searchIcons(all, query)[0][0]).toBe('app-triskel')
    }
    expect(searchIcons(all, 'breizh').map(([name]) => name)).toEqual(['app-gwenn_ha_du', 'app-triskel'])
  })

  it('les dessine au lieu d’un glyphe, sous un nom lisible, sans empiéter sur Nerd Fonts', () => {
    for (const [name, code] of APP_ICON_LIST) {
      expect(appIconOf({ name, code })?.path).toMatch(/^M/)
      expect((icons as NerdIcon[]).some(([, other]) => other === code)).toBe(false)
    }
    expect(new Set(APP_ICON_LIST.map(([, code]) => code)).size).toBe(APP_ICON_LIST.length)
    expect(appIconOf({ name: 'md-home', code: 'f02dc' })).toBeUndefined()
    expect(iconLabel('app-gwenn_ha_du')).toBe('Drapeau breton (Gwenn-ha-du)')
    expect(iconLabel('app-triskel')).toBe('Triskel')
  })
})
