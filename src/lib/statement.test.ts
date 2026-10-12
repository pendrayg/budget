import { describe, expect, it } from 'vitest'
import { parseAmount, parseStatement, type TextItem } from './statement'

/**
 * Un relevé fictif, à la mise en page d'un relevé BoursoBank : les en-têtes de colonnes, des
 * opérations au débit et au crédit, une ligne de détail en retrait, une référence, un pied de page.
 */
function item(page: number, y: number, x: number, str: string, width = str.length * 4.5): TextItem {
  return { page, str, x, xEnd: x + width, y }
}

const page1: TextItem[] = [
  item(1, 427, 95, 'Libellé', 30), item(1, 427, 381, 'Valeur', 29), item(1, 427, 442, 'Débit', 23), item(1, 427, 506, 'Crédit', 27),
  item(1, 405, 327, 'SOLDE AU :'), item(1, 405, 375, '31/08/2026', 41), item(1, 405, 515, '1.000,00', 31),
  item(1, 371, 46, '01/09/2026', 42), item(1, 371, 95, 'CARTE 30/08/26 BOULANGERIE TEST', 160), item(1, 371, 224, 'CB*1234', 32), item(1, 371, 375, '01/09/2026', 41), item(1, 371, 464, '4,20', 15),
  item(1, 360, 46, '02/09/2026', 42), item(1, 360, 95, 'VIR Virement depuis Compte perso', 120), item(1, 360, 375, '02/09/2026', 41), item(1, 360, 515, '2.000,00', 31),
  item(1, 348, 112, 'DUPONT JEAN', 60),
  item(1, 337, 46, '03/09/2026', 42), item(1, 337, 95, 'PRLV SEPA FOURNISSEUR', 110), item(1, 337, 375, '03/09/2026', 41), item(1, 337, 449, '1.234,56', 31),
  item(1, 325, 112, 'Rèf : SCT0000000000000', 140),
  item(1, 97, 83, 'A réception d’un extrait de compte vous disposez d’un délai', 400),
]
const page2: TextItem[] = [
  item(2, 634, 95, 'Libellé', 30), item(2, 634, 381, 'Valeur', 29), item(2, 634, 442, 'Débit', 23), item(2, 634, 506, 'Crédit', 27),
  item(2, 615, 46, '07/09/2026', 42), item(2, 615, 95, 'VIR SEPA DUPONT Jean', 90), item(2, 615, 375, '07/09/2026', 41), item(2, 615, 449, '900,00', 31),
  item(2, 604, 112, 'Pret immobilier maison', 82),
  item(2, 592, 112, 'Rèf : SCT0000000000001', 140),
  item(2, 580, 46, '08/09/2026', 42), item(2, 580, 95, 'CARTE 07/09/26 STATION', 100), item(2, 580, 375, '08/09/2026', 41), item(2, 580, 464, '2,80', 15),
  item(2, 569, 46, '08/09/2026', 42), item(2, 569, 95, 'CARTE 07/09/26 STATION', 100), item(2, 569, 375, '08/09/2026', 41), item(2, 569, 464, '2,80', 15),
]

describe('relevé BoursoBank', () => {
  it('lit les montants à la française', () => {
    expect(parseAmount('1.234,56')).toBe(1234.56)
    expect(parseAmount('4,20')).toBe(4.2)
  })

  it('lit chaque opération : date, libellé sans date de valeur, débit ou crédit selon la colonne', () => {
    const lines = parseStatement([...page2, ...page1])
    expect(lines.map((l) => [l.date, l.label, l.amount])).toEqual([
      ['2026-09-01', 'CARTE 30/08/26 BOULANGERIE TEST CB*1234', 4.2],
      ['2026-09-02', 'VIR Virement depuis Compte perso', -2000],
      ['2026-09-03', 'PRLV SEPA FOURNISSEUR', 1234.56],
      ['2026-09-07', 'VIR SEPA DUPONT Jean', 900],
      ['2026-09-08', 'CARTE 07/09/26 STATION', 2.8],
      ['2026-09-08', 'CARTE 07/09/26 STATION', 2.8],
    ])
  })

  it('garde les lignes de détail parlantes, pas les références ni le pied de page', () => {
    const lines = parseStatement([...page1, ...page2])
    expect(lines[1].detail).toBe('DUPONT JEAN')
    expect(lines[2].detail).toBeUndefined()
    expect(lines[3].detail).toBe('Pret immobilier maison')
  })

  it('ne trouve rien dans un document sans tableau d’opérations', () => {
    expect(parseStatement([item(1, 500, 46, 'Bonjour'), item(1, 480, 46, '01/09/2026')])).toEqual([])
  })
})
