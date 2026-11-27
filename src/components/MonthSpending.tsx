import { DeleteButton } from '../ds'
import { formatEuro, formatEuroDelta } from '../lib/format'
import { monthLabel } from '../lib/month'
import { displayLabel, removeMonth, spendingSummary, type SpendingSummary } from '../lib/spending'
import type { CategoryIcon, Month, State, Transaction } from '../lib/types'
import GlyphIconButton from './GlyphIconButton'
import { categoriesOf, type Scope } from '../lib/scope'

type Update = (change: (state: State) => State) => void

/** Ranger une opération : la ranger dans un dossier, une dépense du budget. */
const PLACE_ICON: CategoryIcon = { name: 'fa-folder_plus', code: 'eec7' }

const day = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`

/** Ce qui dit où une opération est rangée, quand la dépense n'a pas d'icône à elle. */
const FOLDER_ICON: CategoryIcon = { name: 'fa-folder', code: 'f07b' }
const UNPLANNED_ICON: CategoryIcon = { name: 'fa-bolt', code: 'f0e7' }
const SAVING_ICON: CategoryIcon = { name: 'fa-piggy_bank', code: 'eda3' }
const IGNORED_ICON: CategoryIcon = { name: 'fa-ban', code: 'f05e' }

/**
 * Une opération : sa date, son libellé, son montant, et à droite un bouton-icône qui ouvre le
 * choix de rangement. À ranger, toute la ligne est en rouge ; un imprévu, son montant (en vert un
 * crédit). À ranger, c'est un dossier « + » ; rangée, l'icône de sa dépense (un dossier
 * si elle n'en a pas, un éclair pour un imprévu, une tirelire pour l'épargne, un sens interdit
 * pour ce qui n'est pas une dépense) — le nom, lui, est dans le libellé du bouton.
 */
function TransactionRow({ transaction, state, unsorted, onPlace }: { transaction: Transaction; state: State; unsorted: boolean; onPlace: (transaction: Transaction) => void }) {
  const expense = transaction.categoryId ? state.categories.find((c) => c.id === transaction.categoryId) : undefined
  const where =
    expense?.name ?? (transaction.unplanned ? 'Imprévu hors catégorie' : transaction.saving ? 'Versement épargne' : transaction.ignored ? 'Pas une dépense' : undefined)
  const icon = unsorted ? PLACE_ICON : expense ? (expense.icon ?? FOLDER_ICON) : transaction.unplanned ? UNPLANNED_ICON : transaction.saving ? SAVING_ICON : transaction.ignored ? IGNORED_ICON : PLACE_ICON
  const tone = unsorted ? '' : transaction.unplanned ? (transaction.amount > 0 ? ' spend-over' : ' spend-under') : ''
  const label = `Ranger ${displayLabel(transaction.label)}, ${formatEuro(transaction.amount)}${where ? ` : ${where.toLowerCase()}` : ''}`
  return (
    <li className={`tx-row${unsorted ? ' tx-unsorted' : ''}`}>
      <span className="tx-date muted">{day(transaction.date)}</span>
      <span className="tx-label">
        {displayLabel(transaction.label)}
        {transaction.detail && <small className="muted"> · {transaction.detail}</small>}
        {transaction.provisional && <small className="muted"> · provisoire</small>}
      </span>
      <span className={`numeric${tone}`}>{transaction.amount < 0 ? `+${formatEuro(-transaction.amount)}` : formatEuro(transaction.amount)}</span>
      <GlyphIconButton icon={icon} label={label} title={where} onClick={() => onPlace(transaction)} />
    </li>
  )
}

/**
 * Les opérations d'un mois, dans son bouton section (cf. MonthsView) : le récap au budget, puis une simple liste, la plus
 * récente en haut — celles du compte, et celles d'autres comptes rangées dans une dépense de ce
 * budget. Chacune se range d'un appui sur son bouton-icône. Une opération à ranger est en rouge ;
 * un imprévu a son montant en rouge, en vert si c'est un crédit.
 */
export default function MonthSpending({ state, month, scope, update, onPlace }: { state: State; month: Month; scope: Scope; update: Update; onPlace: (transaction: Transaction) => void }) {
  const summary = spendingSummary(state, month, scope)
  const unsorted = new Set(summary.unsorted.map((t) => t.id))
  const here = new Set(categoriesOf(state, scope).map((category) => category.id))
  const transactions = state.transactions
    .filter((t) => t.date.startsWith(month) && ((t.owner ?? null) === scope || (t.categoryId !== undefined && here.has(t.categoryId))))
    .sort((a, b) => b.date.localeCompare(a.date) || a.label.localeCompare(b.label))
  return (
    <div className="spending-month">
      <SpendingRecap summary={summary} />
      <ul className="tx-list">
        {transactions.map((t) => (
          <TransactionRow key={t.id} transaction={t} state={state} unsorted={unsorted.has(t.id)} onPlace={onPlace} />
        ))}
      </ul>
      <div className="form-actions">
        <DeleteButton withLabel label="Supprimer les opérations du mois" confirmLabel={`Confirmer : supprimer les opérations de ${monthLabel(month)}`} onDelete={() => update((s) => removeMonth(s, month, scope))} />
      </div>
    </div>
  )
}

/**
 * L'écart au budget plutôt que les deux montants : « −120,00 € » en vert en deçà, « +190,36 € » en
 * rouge au-delà, « = » pile dessus.
 */
function Delta({ spent, budget, over = spent > budget + 0.005 }: { spent: number; budget: number; over?: boolean }) {
  const delta = spent - budget
  const tone = over ? ' spend-over' : delta < -0.005 ? ' spend-under' : ''
  return (
    <span className={`numeric${tone}`}>
      {/* Pile sur le budget : un « = » plutôt qu'un « 0,00 € » qu'on lirait comme rien dépensé. */}
      {Math.abs(delta) < 0.005 ? '=' : formatEuroDelta(delta)}
      <span className="ds-visually-hidden">
        {' '}
        par rapport au budget : {formatEuro(spent)} sur {formatEuro(budget)}
      </span>
    </span>
  )
}

/**
 * Le récap du mois, en tête de ses opérations : le total face au budget, puis chaque DÉPENSE qui a
 * eu des opérations ce mois-ci et son écart — au mois pour une courante, en enveloppe sur sa
 * période pour une à épargner (en rouge un dépassement, en vert en deçà) —, puis les imprévus.
 */
function SpendingRecap({ summary }: { summary: SpendingSummary }) {
  // Chaque dépense qui a eu une opération ce mois-ci, par ordre alphabétique : au mois une courante,
  // sur sa période (en enveloppe) une à épargner.
  const lines = [...summary.sections, ...summary.savings.sections]
    .flatMap((section) => section.lines)
    .filter((line) => line.transactions.length > 0)
    .sort((a, b) => a.category.name.localeCompare(b.category.name, 'fr'))
  return (
    <dl className="figures spend-recap">
      <div className="figure-row spend-recap-total">
        <dt>Total</dt>
        <dd>
          <Delta spent={summary.spent} budget={summary.budget} />
        </dd>
      </div>
      {lines.map((line) => (
        <div className="figure-row" key={line.category.id}>
          <dt>{line.category.name}</dt>
          <dd>
            <Delta spent={line.year?.spent ?? line.spent} budget={line.year?.budget ?? line.budget} over={line.over} />
          </dd>
        </div>
      ))}
      {summary.unplanned.length > 0 && (
        <div className="figure-row">
          <dt>Imprévus</dt>
          <dd className="numeric">{formatEuro(summary.unplannedTotal)}</dd>
        </div>
      )}
    </dl>
  )
}

/** « 2 dépassements », en rouge. */
export function OverLabel({ count }: { count: number }) {
  return (
    <span className="spend-over">
      {count} dépassement{count > 1 ? 's' : ''}
    </span>
  )
}
