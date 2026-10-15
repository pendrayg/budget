import { Button, SearchField } from '../ds'
import { useState } from 'react'
import { formatEuro } from '../lib/format'
import { categoriesOf } from '../lib/scope'
import { matchesSearch } from '../lib/search'
import { displayLabel, type Placement } from '../lib/spending'
import type { CategoryIcon, State, Transaction } from '../lib/types'
import CategoryGlyph from './CategoryGlyph'
import Sheet from './Sheet'

interface Choice {
  key: string
  name: string
  icon?: CategoryIcon
  placement: Placement
  active: boolean
}

/**
 * Où ranger une opération : la liste des dépenses du budget, chacune avec son icône — ce que le
 * sélecteur natif de l'iPhone ne sait pas montrer (texte seul, dans sa police à lui) —, par ordre
 * alphabétique, puis « Imprévu hors catégorie », « Versement épargne », « Pas une dépense » et
 * « À ranger ». Une recherche, active dès l'ouverture, filtre la liste ; Entrée prend le premier
 * résultat. Un appui range et referme.
 */
export default function PlacementSheet({
  state,
  transaction,
  onPick,
  onClose,
}: {
  state: State
  transaction: Transaction | null
  onPick: (placement: Placement) => void
  onClose: () => void
}) {
  return (
    <Sheet open={transaction !== null} onClose={onClose} title="Ranger l’opération" titleId="placement-title">
      {/* Une clé par opération : la recherche repart de zéro à chaque ouverture. */}
      {transaction && (
        <PlacementChoices
          key={transaction.id}
          state={state}
          transaction={transaction}
          onChoose={(placement) => {
            onPick(placement)
            onClose()
          }}
        />
      )}
    </Sheet>
  )
}

function PlacementChoices({ state, transaction, onChoose }: { state: State; transaction: Transaction; onChoose: (placement: Placement) => void }) {
  const [query, setQuery] = useState('')
  const choices: Choice[] = [
    // Les dépenses du budget de son compte : le commun, ou celui de sa personne.
    ...categoriesOf(state, transaction.owner ?? null)
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
      .map((expense) => ({
        key: expense.id,
        name: expense.name,
        icon: expense.icon,
        placement: { categoryId: expense.id },
        active: transaction.categoryId === expense.id,
      })),
    { key: 'unplanned', name: 'Imprévu hors catégorie', placement: { unplanned: true }, active: transaction.unplanned === true },
    { key: 'saving', name: 'Versement épargne', placement: { saving: true }, active: transaction.saving === true },
    { key: 'ignored', name: 'Pas une dépense', placement: { ignored: true }, active: transaction.ignored === true },
    {
      key: 'unsorted',
      name: 'À ranger',
      placement: null,
      active: !transaction.ignored && !transaction.saving && !transaction.unplanned && !transaction.categoryId,
    },
  ]
  const results = choices.filter((choice) => matchesSearch(choice.name, query))
  return (
    <div className="form">
      <p className="placement-of">
        <span>{displayLabel(transaction.label)}</span>
        <span className="numeric">{formatEuro(transaction.amount)}</span>
      </p>
      <SearchField
        aria-label="Chercher une dépense"
        placeholder="Chercher une dépense"
        value={query}
        onChange={setQuery}
        onClear={() => setQuery('')}
        data-autofocus=""
        onKeyDown={(event) => {
          if (event.key === 'Enter' && query.trim() !== '' && results.length > 0) {
            event.preventDefault()
            onChoose(results[0].placement)
          }
        }}
      />
      {results.length === 0 ? (
        <p className="muted">Aucune dépense pour « {query.trim()} ».</p>
      ) : (
        <ul className="placement-list">
          {results.map((choice) => (
            <li key={choice.key}>
              <Button className="placement-choice" active={choice.active} onClick={() => onChoose(choice.placement)}>
                {choice.icon ? <CategoryGlyph icon={choice.icon} className="placement-icon" /> : <span className="placement-icon" aria-hidden="true" />}
                {choice.name}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
