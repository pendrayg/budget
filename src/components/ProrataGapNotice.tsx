import { Button, Notice } from '@pendrayg/neomorphism-design-system'
import { monthLabel, monthLabelOf, shortMonthLabel } from '../lib/month'
import type { Month } from '../lib/types'

/** « janv. 2026, févr. 2026 et mars 2026 » ; au-delà de quatre, la première et la dernière. */
function listMonths(months: Month[]): string {
  if (months.length > 4) return `entre ${shortMonthLabel(months[0])} et ${shortMonthLabel(months[months.length - 1])}`
  const labels = months.map(shortMonthLabel)
  return labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(', ')} et ${labels[labels.length - 1]}`
}

function describe(month: Month, missing: Month[], counted: number, span: number): string {
  // `counted` : les mois que le prorata moyenne vraiment, ceux où tous les revenus sont saisis.
  const effect =
    counted > 0
      ? `le prorata ${monthLabelOf(month)} se calcule sur ${counted} mois au lieu de ${span}.`
      : `le prorata ${monthLabelOf(month)} n’a aucun revenu sur lequel se calculer : parts égales.`
  if (missing.length === 1) return effect.charAt(0).toUpperCase() + effect.slice(1)
  return `${listMonths(missing).replace(/^./, (c) => c.toUpperCase())} : ${effect}`
}

/**
 * Le prorata du mois regardé repose sur une année incomplète : des mois de cette année — passés,
 * en cours ou à venir — n'ont pas leurs revenus. En rouge, parce que les montants affichés dessous en dépendent — ce ne
 * sont pas les vrais tant que ces mois manquent.
 */
export default function ProrataGapNotice({
  month,
  missing,
  span,
  counted,
  onEnter,
}: {
  month: Month
  missing: Month[]
  span: number
  /** Les mois effectivement moyennés par le prorata de ce mois. */
  counted: number
  onEnter: (month: Month) => void
}) {
  if (missing.length === 0) return null
  const title = missing.length === 1 ? `Revenus ${monthLabelOf(missing[0])} manquants` : `${missing.length} mois de revenus manquants`
  return (
    <Notice title={title} className="notice-danger" role="alert">
      <span className="reminder-text">{describe(month, missing, counted, span)}</span>
      <Button tone="link" onClick={() => onEnter(missing[0])}>
        Saisir {monthLabel(missing[0])}
      </Button>
    </Notice>
  )
}
