import { Button, SearchField } from '../ds'
import { useState } from 'react'
import { formatEuro } from '../lib/format'
import { categoriesOf, type Scope } from '../lib/scope'
import { matchesSearch } from '../lib/search'
import { budgetAt, versionMonthly } from '../lib/budget'
import { displayLabel, inCategory, placeableAt, scaleSplits, shares, type Placement } from '../lib/spending'
import type { CategoryIcon, State, Transaction } from '../lib/types'
import CategoryGlyph from './CategoryGlyph'
import Sheet from './Sheet'

interface Choice {
  key: string
  name: string
  /** Le budget de la dépense, quand ce n'est pas celui du compte de l'opération. */
  budget?: string
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
  // Les dépenses se COCHENT : une ou plusieurs (un prélèvement pour la cantine et le périscolaire,
  // pour trois contrats d'un même assureur), puis « Ranger ». Plusieurs, l'opération se partage au
  // prorata de leur budget du mois — à parts égales si l'une n'en a pas —, sans montant à saisir.
  const [picked, setPicked] = useState<string[]>(shares(transaction).map((part) => part.categoryId))
  const month = transaction.date.slice(0, 7)
  const budgetOf = (categoryId: string) => {
    const version = budgetAt(state, categoryId, month)
    return version ? Math.abs(versionMonthly(version, month)) : 0
  }
  const placement = (): Placement => {
    if (picked.length === 1) return { categoryId: picked[0] }
    const weights = picked.map(budgetOf)
    // Une dépense cochée sans budget ce mois-ci n'aurait rien : on partage alors à parts égales.
    const usable = weights.every((weight) => weight > 0) ? weights : picked.map(() => 1)
    return { splits: scaleSplits(picked.map((categoryId, index) => ({ categoryId, amount: usable[index] })), transaction.amount) }
  }
  const toggle = (categoryId: string) => setPicked(picked.includes(categoryId) ? picked.filter((id) => id !== categoryId) : [...picked, categoryId])
  // Les dépenses du budget de son compte d'abord, puis celles des autres budgets : un relevé perso
  // porte aussi des dépenses du foyer, et le relevé du foyer, parfois, celle d'une personne.
  const account: Scope = transaction.owner ?? null
  const scopes: Scope[] = [account, ...[null, ...state.people.map((person) => person.id)].filter((scope) => scope !== account)]
  const budgetName = (scope: Scope) => (scope === null ? 'Foyer' : (state.people.find((person) => person.id === scope)?.name ?? ''))
  const names = new Map(state.categories.map((category) => [category.id, category.name]))
  const choices: Choice[] = [
    ...scopes.flatMap((scope) =>
      // Sans celles arrêtées le mois de l'opération — un projet supprimé (celle où elle est rangée reste).
      categoriesOf(state, scope)
        .filter((expense) => inCategory(transaction, expense.id) || placeableAt(state, expense.id, transaction.date))
        .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
        .map((expense) => ({
          key: expense.id,
          name: expense.name,
          ...(scope !== account ? { budget: budgetName(scope) } : {}),
          icon: expense.icon,
          placement: { categoryId: expense.id },
          active: picked.includes(expense.id),
        })),
    ),
    { key: 'unplanned', name: 'Imprévu hors catégorie', placement: { unplanned: true }, active: transaction.unplanned === true },
    { key: 'saving', name: 'Versement épargne', placement: { saving: true }, active: transaction.saving === true },
    { key: 'ignored', name: 'Pas une dépense', placement: { ignored: true }, active: transaction.ignored === true },
    {
      key: 'unsorted',
      name: 'À ranger',
      placement: null,
      active: !transaction.ignored && !transaction.saving && !transaction.unplanned && shares(transaction).length === 0,
    },
  ]
  const results = choices.filter((choice) => matchesSearch(choice.budget ? `${choice.name} ${choice.budget}` : choice.name, query))
  // Une dépense se coche ; le reste (imprévu, épargne, écartée, à ranger) range d'un appui.
  const choose = (choice: Choice) => (choice.placement && 'categoryId' in choice.placement ? toggle(choice.placement.categoryId) : onChoose(choice.placement))
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
            choose(results[0])
          }
        }}
      />
      {results.length === 0 ? (
        <p className="muted">Aucune dépense pour « {query.trim()} ».</p>
      ) : (
        <ul className="placement-list">
          {results.map((choice) => {
            const expense = choice.placement !== null && 'categoryId' in choice.placement
            return (
              <li key={choice.key}>
                <Button className="placement-choice" active={choice.active} aria-pressed={expense ? choice.active : undefined} onClick={() => choose(choice)}>
                  {choice.icon ? <CategoryGlyph icon={choice.icon} className="placement-icon" /> : <span className="placement-icon" aria-hidden="true" />}
                  <span className="placement-name">{choice.name}</span>
                  {choice.budget && <span className="placement-budget muted">{choice.budget}</span>}
                </Button>
              </li>
            )
          })}
        </ul>
      )}
      {/* Collé au bas de la feuille : ce qui est coché, et « Ranger ». */}
      {picked.length > 0 && (
        <div className="split-parts">
          <p className="field-hint muted">{picked.map((id) => names.get(id)).join(' · ')}</p>
          <Button tone="primary" onClick={() => onChoose(placement())}>
            {picked.length > 1 ? `Ranger dans ${picked.length} dépenses` : 'Ranger'}
          </Button>
        </div>
      )}
    </div>
  )
}
