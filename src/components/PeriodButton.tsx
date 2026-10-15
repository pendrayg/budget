import { Button } from '../ds'
import { PERIOD_LABELS, PERIOD_SHORT, PERIODS } from '../lib/amount'
import type { Period } from '../lib/types'

/**
 * Un bouton à plusieurs valeurs : il montre la périodicité courante, et chaque appui passe à la
 * suivante (Mois → Trim. → An → Mois). Une commande momentanée du DS, pas une bascule :
 * aucune valeur n'est « enfoncée », il n'y a que celle qui est affichée.
 */
export default function PeriodButton({ value, onChange, label }: { value: Period; onChange: (period: Period) => void; label: string }) {
  const next = PERIODS[(PERIODS.indexOf(value) + 1) % PERIODS.length]
  return (
    <Button className="period-button" aria-label={`${label} : ${PERIOD_LABELS[value]}. Passer à ${PERIOD_LABELS[next]}`} onClick={() => onChange(next)}>
      {PERIOD_SHORT[value]}
    </Button>
  )
}
