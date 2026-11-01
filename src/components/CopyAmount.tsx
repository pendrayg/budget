import { useEffect, useRef, useState } from 'react'
import { amountForClipboard, formatEuro } from '../lib/format'

/**
 * Un gros montant de synthèse, qui se COPIE d'un clic, sans rien qui l'annonce : un appui le met
 * dans le presse-papier (« 1234,56 »), et il dit « Copié » le temps d'une seconde.
 */
export default function CopyAmount({ value, className = 'summary-amount' }: { value: number; className?: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const copy = () => {
    void navigator.clipboard?.writeText(amountForClipboard(value)).then(
      () => {
        setCopied(true)
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => setCopied(false), 1000)
      },
      () => undefined,
    )
  }
  return (
    <span className={className} onClick={copy}>
      {copied ? 'Copié' : formatEuro(value)}
    </span>
  )
}
