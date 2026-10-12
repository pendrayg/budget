import type { CSSProperties, ReactNode } from 'react'

/**
 * Un chiffre de synthèse souligné comme la ligne du graphique qu'il légende : trait plein ou
 * pointillé, à la couleur de la ligne ; le chiffre reste à l'encre du texte. Sans graphique, il
 * n'y a rien à légender : le chiffre reste nu.
 */
export default function Underlined({ shown = true, color, dashed, children }: { shown?: boolean; color: string; dashed?: boolean; children: ReactNode }) {
  if (!shown) return <>{children}</>
  return (
    <span className={`summary-underline${dashed ? ' summary-underline-dashed' : ''}`} style={{ '--trait': color } as CSSProperties}>
      {children}
    </span>
  )
}
