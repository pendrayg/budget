import { useEffect, type RefObject } from 'react'
import { shortMonthLabel } from '../lib/month'

/** Un pas de graduation rond (1, 2, 2,5 ou 5 × 10ⁿ) pour couvrir `span` en `count` intervalles. */
export function niceStep(span: number, count: number): number {
  const raw = Math.max(span, 1) / count
  const power = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * power >= raw) ?? 10
  return step * power
}

/** Le haut d'une échelle qui part de zéro : `top` et un peu d'air, arrondi à un pas rond. */
export function niceCeiling(top: number): number {
  const ceiling = top * 1.15
  const step = niceStep(ceiling, 8)
  return Math.max(step, Math.ceil(ceiling / step) * step)
}

/**
 * Un repère de mois. Un graphique occupe toute la largeur du contenu, bord à bord avec les
 * sections : le premier repère s'aligne donc à gauche sur son point, le dernier à droite sur le
 * bord, et les autres se centrent — sans quoi les deux extrêmes déborderaient du cadre.
 */
export function MonthTick({ x, y, payload, months }: { x?: number; y?: number; payload?: { value: number }; months: string[] }) {
  const index = payload?.value ?? 0
  // Le dernier repère peut être posé au-delà du dernier mois (le bord droit) : il porte ce mois-là.
  const month = months[Math.min(index, months.length - 1)]
  if (month === undefined || x === undefined || y === undefined) return null
  const anchor = index === 0 ? 'start' : index >= months.length - 1 ? 'end' : 'middle'
  return (
    <text x={x} y={y} dy={12} textAnchor={anchor} fill="var(--color-muted)" fontSize={12}>
      {shortMonthLabel(month)}
    </text>
  )
}

/** Au plus quatre repères de mois, répartis sur la série, le dernier toujours montré. */
export function monthTicks(count: number): number[] {
  if (count <= 4) return Array.from({ length: count }, (_, i) => i)
  const step = (count - 1) / 3
  return [0, Math.round(step), Math.round(2 * step), count - 1]
}

/**
 * Les lignes sont entaillées dans la page comme toute marque de graphique du DS
 * (`#ds-chart-groove`, posé en ATTRIBUT : sur WebKit, un `url(#…)` écrit dans une feuille séparée
 * ne se résout pas). recharts ne pose `filter` que sur le tracé : on le met sur le GROUPE de chaque
 * série marquée `serie-rainuree` — sa zone est en pourcentage de la boîte de l'élément filtré, et
 * une ligne parfaitement horizontale, de hauteur nulle, s'effaçait. Le graphique est dessiné APRÈS
 * le composant (`ResponsiveContainer` attend d'avoir mesuré sa place), puis redessiné à chaque
 * changement de taille : on suit donc ses ajouts d'éléments.
 */
export function useGroove(frame: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = frame.current
    if (!root) return
    const apply = () =>
      root.querySelectorAll('g.serie-rainuree').forEach((group) => {
        if (group.getAttribute('filter') !== 'url(#ds-chart-groove)') group.setAttribute('filter', 'url(#ds-chart-groove)')
      })
    apply()
    const observer = new MutationObserver(apply)
    observer.observe(root, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [frame])
}
