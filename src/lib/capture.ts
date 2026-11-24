import type { StatementLine } from './statement'

/**
 * LIRE UNE CAPTURE D'ÉCRAN de la liste des opérations de l'app BoursoBank — ce qui est passé
 * depuis le dernier relevé. La lecture (OCR, cf. ocr.ts) se fait sur le téléphone, en trois bandes
 * verticales de l'image : à gauche les jours (« Hier », « Jeudi 19 novembre 2026 »), au milieu les
 * libellés (sans les logos, qui brouillent la lecture), à droite les montants. Ce module, pur, en
 * fait des opérations : chaque montant est une ligne ; les libellés qui l'entourent, son nom ; le
 * jour au-dessus, sa date. Un paiement « en cours » (une autorisation de carte) n'est pas encore
 * une opération : il est écarté, il reviendra une fois débité.
 */

/** Les bandes de la capture, en fraction de sa largeur (la mise en page de l'app BoursoBank). */
export const CAPTURE_COLUMNS = {
  /** Les jours : depuis le bord, jusqu'aux montants. */
  days: [0, 0.71],
  /** Les libellés : après les logos, jusqu'aux montants. */
  labels: [0.16, 0.71],
  /** Les montants : avant le chevron. */
  amounts: [0.71, 0.93],
} as const

/** Une ligne lue : son texte et sa hauteur dans l'image (en pixels, du haut). */
export interface OcrLine {
  text: string
  top: number
  bottom: number
}

export interface CaptureRead {
  days: OcrLine[]
  labels: OcrLine[]
  amounts: OcrLine[]
}

export interface CaptureLine extends StatementLine {
  /** Sous le premier jour lisible : la date est celle de ce jour, au mieux. */
  dateGuessed?: true
}

export interface CaptureResult {
  lines: CaptureLine[]
  /** Les paiements en cours, écartés. */
  pending: number
}

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

const iso = (date: Date) => date.toISOString().slice(0, 10)
const shift = (day: string, days: number) => iso(new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000))
const plain = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** « Hier », « Aujourd'hui », « Jeudi 19 novembre 2026 », « 19 novembre » : la date, vue de `today`. */
export function parseDay(text: string, today: string): string | null {
  const t = plain(text).trim()
  if (/^aujourd.?hui$/.test(t)) return today
  if (/^hier$/.test(t)) return shift(today, -1)
  if (/^avant.?hier$/.test(t)) return shift(today, -2)
  const match = /(?:^|\s)(\d{1,2})(?:er)?\s+([a-z]+)(?:\s+(\d{4}))?\s*$/.exec(t)
  if (!match) return null
  const month = MONTHS.findIndex((name) => plain(name) === match[2])
  if (month < 0) return null
  const day = Number(match[1])
  // Sans année, celle d'aujourd'hui — ou la précédente, si le jour serait encore à venir.
  let year = match[3] ? Number(match[3]) : Number(today.slice(0, 4))
  const at = (y: number) => `${y}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  if (!match[3] && at(year) > today) year -= 1
  const date = at(year)
  return Number.isNaN(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).getUTCDate() !== day ? null : date
}

/** « -7,00 € », « +289,50 € », « 1 234,56 € » : le montant au sens d'un relevé — positif un débit, négatif un crédit. Sans signe lu, un débit. */
export function parseAmount(text: string): number | null {
  const match = /([+-]?)\s*(\d{1,3}(?:[\s.  ]?\d{3})*),(\d{2})\s*€/.exec(text.replace(/[‐‑–—−]/g, '-'))
  if (!match) return null
  const value = Number(`${match[2].replace(/[\s.  ]/g, '')}.${match[3]}`)
  return match[1] === '+' ? -value : value
}

const PENDING = /autorisation|en cours/i
const middle = (line: OcrLine) => (line.top + line.bottom) / 2
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted.length === 0 ? 0 : sorted[Math.floor(sorted.length / 2)]
}

/**
 * Les opérations d'une capture lue. Chaque montant, et chaque jour, est une borne ; une ligne de
 * libellé appartient au montant dont elle est le plus près, sans franchir un jour — à mi-chemin
 * de ses voisins, et pas plus loin que quatre lignes au-dessus ou au-dessous en bord de capture.
 */
export function parseCapture(read: CaptureRead, today: string): CaptureResult {
  type Anchor = { kind: 'day'; at: number; date: string } | { kind: 'amount'; at: number; amount: number }
  const anchors: Anchor[] = [
    ...read.days.flatMap((line): Anchor[] => {
      const date = parseDay(line.text, today)
      return date ? [{ kind: 'day', at: middle(line), date }] : []
    }),
    ...read.amounts.flatMap((line): Anchor[] => {
      const amount = parseAmount(line.text)
      return amount === null ? [] : [{ kind: 'amount', at: middle(line), amount }]
    }),
  ].sort((a, b) => a.at - b.at)
  const reach = 4 * (median(read.labels.map((line) => line.bottom - line.top)) || 40)
  const firstDay = anchors.find((anchor) => anchor.kind === 'day')
  let day: string | null = null
  let pending = 0
  const lines: CaptureLine[] = []
  anchors.forEach((anchor, index) => {
    if (anchor.kind === 'day') {
      day = anchor.date
      return
    }
    const above = index > 0 ? (anchors[index - 1].at + anchor.at) / 2 : anchor.at - reach
    const below = index < anchors.length - 1 ? (anchor.at + anchors[index + 1].at) / 2 : anchor.at + reach
    const own = read.labels.filter((line) => middle(line) >= above && middle(line) < below).sort((a, b) => a.top - b.top)
    // Chaque ligne sans ce que l'OCR laisse traîner à sa fin (un « : » pour un « u » coupé, le chevron).
    const words = own.map((line) => line.text.replace(/[\s:;,.'’“”»>|_-]+$/, '').trim()).filter((text) => text !== '')
    if (words.some((text) => PENDING.test(text))) {
      pending += 1
      return
    }
    const label = words.join(' ').replace(/\s+/g, ' ')
    const date = day ?? (firstDay?.kind === 'day' ? firstDay.date : today)
    if (label === '') return
    lines.push({ date, label, amount: anchor.amount, ...(day ? {} : { dateGuessed: true as const }) })
  })
  return { lines, pending }
}
