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
  person,
  state,
  update,
  onClose,
}: {
  open: boolean
  generation: number
  month: Month
  /** Ouverte depuis le compte d'une personne : ses revenus seuls, sans sélecteur. */
  person?: string
  state: State
  update: (change: (state: State) => State) => void
  onClose: () => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title={`Revenus ${monthLabelOf(month)}`} titleId="income-title">
      <IncomeForm key={generation} month={month} chooseMonth person={person} state={state} update={update} />
    </Sheet>
  )
}
