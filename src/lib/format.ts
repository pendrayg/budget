const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2, minimumFractionDigits: 2 })
const euroRound = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const euroDelta = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2, minimumFractionDigits: 2, signDisplay: 'exceptZero' })
const percent = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 1 })

export function formatEuro(value: number): string {
  return euro.format(Number.isFinite(value) ? value : 0)
}

/** Un écart, toujours signé : « +190,36 € », « −120,00 € » (vrai signe moins), « 0,00 € ». */
export function formatEuroDelta(value: number): string {
  return euroDelta.format(Number.isFinite(value) ? value : 0).replace('-', '−')
}

/** Sans centimes, pour les gros chiffres qui se lisent de loin. */
export function formatEuroRound(value: number): string {
  return euroRound.format(Number.isFinite(value) ? value : 0)
}

export function formatPercent(ratio: number): string {
  return percent.format(Number.isFinite(ratio) ? ratio : 0)
}

/** Un nombre saisi à la française (virgule) ou à l'anglaise ; `null` si ce n'en est pas un. */
export function parseNumber(text: string): number | null {
  const cleaned = text.replace(/\s/g, '').replace(',', '.')
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function nowIso(): string {
  return new Date().toISOString()
}
