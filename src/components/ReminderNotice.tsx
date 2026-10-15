import { Button, Notice } from '../ds'
import { monthLabel, monthLabelOf } from '../lib/month'
import type { Month } from '../lib/types'

/**
 * Le rappel du classeur qu'on n'ouvrait plus : un mois est passé, ses revenus ne sont pas
 * saisis, et le prorata ne bougera pas tant qu'ils ne le seront pas.
 */
export default function ReminderNotice({ months, onEnter }: { months: Month[]; onEnter: (month: Month) => void }) {
  if (months.length === 0) return null
  const oldest = months[0]
  const title = months.length === 1 ? `Revenus ${monthLabelOf(oldest)} non saisis` : `${months.length} mois sans revenus saisis`
  return (
    <Notice tone="warn" title={title} className="reminder">
      <span className="reminder-text">
        {months.length === 1
          ? 'Tant qu’il manque, le prorata de l’année glissante se calcule sans lui.'
          : `De ${monthLabel(oldest)} à ${monthLabel(months[months.length - 1])} : ces mois manquent au prorata de l’année glissante.`}
      </span>
      <Button tone="link" onClick={() => onEnter(oldest)}>
        Saisir {monthLabel(oldest)}
      </Button>
    </Notice>
  )
}
