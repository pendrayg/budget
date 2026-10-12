/**
 * La lecture d'un relevé de compte BoursoBank (PDF) : de ses morceaux de texte positionnés, les
 * opérations — date, libellé, montant au débit ou au crédit.
 *
 * Le relevé est un tableau : « Date opération », « Libellé », « Valeur », « Débit », « Crédit ».
 * Une opération est une ligne qui commence par sa date, à gauche ; ses lignes suivantes, en
 * retrait, la complètent (le nom d'un virement, des références). Le montant est au débit ou au
 * crédit selon sa COLONNE, qu'on lit à sa position sous les en-têtes : le texte seul ne le dit pas.
 *
 * Fonction pure, sur des morceaux de texte déjà extraits (cf. `pdf.ts`) : testable sans PDF.
 */

/** Un morceau de texte du PDF : sa page, son abscisse de début et de fin, son ordonnée. */
export interface TextItem {
  page: number
  str: string
  x: number
  xEnd: number
  y: number
}

/** Une opération lue sur le relevé. `amount` est positif au débit, négatif au crédit. */
export interface StatementLine {
  date: string
  label: string
  detail?: string
  amount: number
}

const DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/
const AMOUNT = /^\d{1,3}(?:\.\d{3})*,\d{2}$/

/** « 1.234,56 » → 1234.56 */
export function parseAmount(text: string): number {
  return Number(text.replace(/\./g, '').replace(',', '.'))
}

/** « 07/09/2026 » → « 2026-09-07 » */
function isoDate(text: string): string | null {
  const match = DATE.exec(text.trim())
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null
}

/** Les morceaux d'une page rangés en lignes, de haut en bas, chacune de gauche à droite. */
function linesOf(items: TextItem[]): TextItem[][] {
  const lines: TextItem[][] = []
  const sorted = items.filter((item) => item.str.trim() !== '').sort((a, b) => b.y - a.y || a.x - b.x)
  for (const item of sorted) {
    const line = lines[lines.length - 1]
    if (line && Math.abs(line[0].y - item.y) <= 2) line.push(item)
    else lines.push([item])
  }
  return lines.map((line) => line.sort((a, b) => a.x - b.x))
}

/**
 * Une ligne sous l'opération qui vaut d'être gardée : des mots (le nom d'un virement, son motif),
 * pas une référence technique (« Rèf : … », « RUM … », un code d'un seul tenant).
 */
function usefulDetail(text: string): boolean {
  const clean = text.trim()
  const letters = (clean.match(/\p{L}/gu) ?? []).length
  const digits = (clean.match(/\d/g) ?? []).length
  return /\s/.test(clean) && /\p{L}{3}/u.test(clean) && letters >= digits && !/^(R[èe]f\b|RUM\b)/i.test(clean)
}

/** Les opérations d'un relevé, dans l'ordre. Un relevé qui n'a pas la forme attendue n'en donne aucune. */
export function parseStatement(items: TextItem[]): StatementLine[] {
  const operations: StatementLine[] = []
  const pages = [...new Set(items.map((item) => item.page))].sort((a, b) => a - b)
  for (const page of pages) {
    const lines = linesOf(items.filter((item) => item.page === page))
    // Les colonnes, d'après les en-têtes de la page.
    const header = lines.find((line) => line.some((i) => i.str.trim() === 'Débit') && line.some((i) => i.str.trim() === 'Crédit'))
    if (!header) continue
    const debit = header.find((i) => i.str.trim() === 'Débit') as TextItem
    const credit = header.find((i) => i.str.trim() === 'Crédit') as TextItem
    const value = header.find((i) => i.str.trim() === 'Valeur')
    const label = header.find((i) => i.str.trim() === 'Libellé')
    // Un montant est aligné à droite sous son en-tête : au débit s'il finit avant le milieu des deux.
    const split = (debit.xEnd + credit.xEnd) / 2
    // La date de valeur commence un peu avant son en-tête : la marge l'écarte du libellé.
    const labelEnd = value ? value.x - 10 : debit.x - 10
    const dateEnd = label ? label.x - 2 : Infinity

    let current: { line: StatementLine; y: number; details: string[] } | null = null
    const close = () => {
      if (!current) return
      const detail = current.details.filter(usefulDetail).slice(0, 2).join(' · ')
      operations.push(detail ? { ...current.line, detail } : current.line)
      current = null
    }
    for (const line of lines) {
      if (line[0].y >= header[0].y) continue
      const date = line[0].x < dateEnd ? isoDate(line[0].str) : null
      const amountItem = [...line].reverse().find((i) => AMOUNT.test(i.str.trim()) && i.x > labelEnd)
      if (date && amountItem) {
        close()
        const text = line
          .slice(1)
          .filter((i) => i.x < labelEnd)
          .map((i) => i.str.trim())
          .join(' ')
          .replace(/\s+/g, ' ')
        const amount = parseAmount(amountItem.str.trim())
        current = { line: { date, label: text, amount: amountItem.xEnd <= split ? amount : -amount }, y: line[0].y, details: [] }
        continue
      }
      // Une ligne en retrait, juste sous l'opération : son complément. Plus loin, c'est le pied de page.
      if (current && !date && line.every((i) => i.x >= dateEnd && i.x < labelEnd) && current.y - line[0].y <= 14) {
        current.details.push(line.map((i) => i.str.trim()).join(' '))
        current.y = line[0].y
        continue
      }
      close()
    }
    close()
  }
  return operations
}
