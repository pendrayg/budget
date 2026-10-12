import type { Month, State } from '../lib/types'
import CategoryForm from './CategoryForm'
import GroupForm from './GroupForm'
import Sheet from './Sheet'

/** Ce que la feuille crée : une catégorie, ou une dépense dans une catégorie. */
export type Creating = { kind: 'group'; owner?: string | null } | { kind: 'expense'; groupId: string }

/**
 * La feuille d'une création : une NOUVELLE catégorie (le bouton du bas de l'écran), ou une
 * NOUVELLE dépense dans une catégorie (son bouton, dans la catégorie dépliée). Ce qui existe se
 * modifie dans sa ligne, dépliée. Le formulaire est remonté à chaque ouverture (`generation`) :
 * il repart vierge.
 */
export default function CategorySheet({
  open,
  creating,
  generation,
  month,
  state,
  update,
  onClose,
}: {
  open: boolean
  creating: Creating
  generation: number
  month: Month
  state: State
  update: (change: (state: State) => State) => void
  onClose: () => void
}) {
  const expense = creating.kind === 'expense'
  const groupName = expense ? state.groups.find((g) => g.id === creating.groupId)?.name : undefined
  // Une catégorie personnelle dit à qui elle est.
  const ownerName = creating.kind === 'group' && creating.owner && state.people.length > 1 ? state.people.find((person) => person.id === creating.owner)?.name : undefined
  return (
    <Sheet open={open} onClose={onClose} title={expense ? `Nouvelle dépense${groupName ? ` · ${groupName}` : ''}` : `Nouvelle catégorie${ownerName ? ` · ${ownerName}` : ''}`} titleId="category-title">
      {expense ? (
        <CategoryForm key={generation} categoryId={null} groupId={creating.groupId} month={month} state={state} update={update} onDone={onClose} />
      ) : (
        <GroupForm key={generation} groupId={null} owner={creating.kind === 'group' ? (creating.owner ?? null) : null} month={month} state={state} update={update} onDone={onClose} />
      )}
    </Sheet>
  )
}
