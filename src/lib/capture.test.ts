import { describe, expect, it } from 'vitest'
import { parseAmount, parseCapture, parseDay, type CaptureRead } from './capture'
// Ce que l'OCR a lu d'une vraie capture de l'app BoursoBank, bande par bande, dans le navigateur
// (cf. ocr.ts) — « Pain Ai » : la bande des libellés coupe le « u » de « Au ».
import read from './capture.fixture.json'

describe('jours d’une capture', () => {
  it('lit les jours relatifs et datés', () => {
    expect(parseDay('Hier', '2026-11-21')).toBe('2026-11-20')
    expect(parseDay('Aujourd’hui', '2026-11-21')).toBe('2026-11-21')
    expect(parseDay('Jeudi 19 novembre 2026', '2026-11-21')).toBe('2026-11-19')
    expect(parseDay('Lundi 1er décembre', '2026-12-03')).toBe('2026-12-01')
    // Sans année, un jour à venir est de l'an dernier.
    expect(parseDay('Mardi 30 décembre', '2027-01-02')).toBe('2026-12-30')
    expect(parseDay('Vir Correction Commun', '2026-11-21')).toBeNull()
    expect(parseDay('31 février 2026', '2026-11-21')).toBeNull()
  })
})

describe('montants d’une capture', () => {
  it('lit le signe, sinon un débit', () => {
    expect(parseAmount('-7,00 €')).toBe(7)
    expect(parseAmount('+289,50 €')).toBe(-289.5)
    expect(parseAmount('16,97 €')).toBe(16.97)
    expect(parseAmount('−1 234,56 €')).toBe(1234.56)
    expect(parseAmount('7')).toBeNull()
  })
})

describe('une capture lue', () => {
  it('fait des opérations, sans le paiement en cours', () => {
    const { lines, pending } = parseCapture(read as CaptureRead, '2026-11-21')
    expect(pending).toBe(1)
    expect(lines).toEqual([
      { date: '2026-11-20', label: 'Boulangerie Artisanale De Pain Ai Levain Paris — Poilâne', amount: 7 },
      { date: '2026-11-20', label: 'Amazon', amount: 16.97 },
      { date: '2026-11-20', label: 'Vir Correction Commun', amount: 169.47 },
      { date: '2026-11-20', label: 'Vir Correction Epargne Commun', amount: -289.5 },
      { date: '2026-11-19', label: 'Achat The Corner Sony Playstation', amount: 74.4 },
      { date: '2026-11-19', label: 'Intermarché', amount: 190.76 },
      { date: '2026-11-17', label: 'Amazon', amount: 1.99 },
      { date: '2026-11-17', label: 'Grand Frais', amount: 14.31 },
    ])
  })

  it('date au mieux ce qui est au-dessus du premier jour lisible', () => {
    const { lines } = parseCapture({ days: [{ text: 'Mardi 17 novembre 2026', top: 300, bottom: 340 }], labels: [{ text: 'Amazon', top: 100, bottom: 140 }], amounts: [{ text: '-1,99 €', top: 100, bottom: 140 }] }, '2026-11-21')
    expect(lines).toEqual([{ date: '2026-11-17', label: 'Amazon', amount: 1.99, dateGuessed: true }])
  })
})
