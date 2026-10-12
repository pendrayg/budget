import { monthLabelOf } from '../lib/month'
import type { Month, State } from '../lib/types'
import IncomeForm from './IncomeForm'
import Sheet from './Sheet'

/**
 * La feuille de SAISIE d'un mois : le mois s'y choisit. Un mois déjà saisi se modifie aussi dans sa
 * ligne, dépliée. Le formulaire est remonté à chaque ouverture (`generation`).
 */
export default function IncomeSheet({
  open,
  generation,
  month,
  state,
  update,
  onClose,
}: {
  open: boolean
  generation: number
  month: Month
  state: State
  update: (change: (state: State) => State) => void
  onClose: () => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title={`Revenus ${monthLabelOf(month)}`} titleId="income-title">
      <IncomeForm key={generation} month={month} chooseMonth state={state} update={update} />
    </Sheet>
  )
}
