import { Button, DeleteButton, DisclosureButton, IconButton } from '../ds'
import { useOpenLine } from '../hooks/useOpenLine'
import { formatEuro, formatEuroDelta } from '../lib/format'
import { monthLabel } from '../lib/month'
import { displayLabel, removeMonth, spendingSummary, type SpendingLine } from '../lib/spending'
import type { Month, State, Transaction } from '../lib/types'
import CategoryGlyph from './CategoryGlyph'
import type { Scope } from '../lib/scope'

type Update = (change: (state: State) => State) => void

const day = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`

/**
 * Une opération : sa date, son libellé, son montant, et où elle est rangée — un appui en change.
 * À ranger, elle n'a encore nulle part où être : un bouton-icône, à droite du montant, ouvre le
 * choix, sans occuper une ligne entière.
 */
function TransactionRow({ transaction, state, onPlace }: { transaction: Transaction; state: State; onPlace: (transaction: Transaction) => void }) {
  const expense = transaction.categoryId ? state.categories.find((c) => c.id === transaction.categoryId) : undefined
  const where =
    expense?.name ?? (transaction.unplanned ? 'Imprévu hors catégorie' : transaction.saving ? 'Versement épargne' : transaction.ignored ? 'Pas une dépense' : undefined)
  if (!where) {
    return (
      <li className="tx-row tx-row-unsorted">
        <span className="tx-date muted">{day(transaction.date)}</span>
        <span className="tx-label">
          {displayLabel(transaction.label)}
          {transaction.detail && <small className="muted"> · {transaction.detail}</small>}
        </span>
        <span className="numeric">{formatEuro(transaction.amount)}</span>
        <IconButton icon="tray_arrow_down" label={`Ranger ${displayLabel(transaction.label)}, ${formatEuro(transaction.amount)}`} onClick={() => onPlace(transaction)} />
      </li>
    )
  }
  return (
    <li className="tx-row">
      <span className="tx-date muted">{day(transaction.date)}</span>
      <span className="tx-label">
        {displayLabel(transaction.label)}
        {transaction.detail && <small className="muted"> · {transaction.detail}</small>}
      </span>
      <span className="numeric">{formatEuro(transaction.amount)}</span>
      <Button className="tx-place" aria-label={`Ranger ${displayLabel(transaction.label)}, ${formatEuro(transaction.amount)} : ${where.toLowerCase()}`} onClick={() => onPlace(transaction)}>
        {expense?.icon && <CategoryGlyph icon={expense.icon} className="placement-icon" />}
        <span>{where}</span>
      </Button>
    </li>
  )
}

/** Une dépense qui a eu des opérations ce mois-ci : seules celles-là, et leurs catégories, s'affichent. */
const spentIn = (line: SpendingLine) => line.transactions.length > 0

/**
 * L'écart au budget plutôt que les deux montants : « −120,00 € » en vert sous le budget,
 * « +190,36 € » en rouge au-delà, « = » pile dessus. `judged` à faux (le versement d'épargne) : l'écart sans couleur,
 * mettre de côté plus ou moins que prévu n'étant ni une économie ni une surdépense.
 */
function Delta({ spent, budget, over = spent > budget + 0.005, judged = true }: { spent: number; budget: number; over?: boolean; judged?: boolean }) {
  const delta = spent - budget
  const tone = !judged ? '' : over ? ' spend-over' : delta < -0.005 ? ' spend-under' : ''
  return (
    <span className={`numeric spend-versus${tone}`}>
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
 * Les dépenses d'un mois, dans son bouton section (cf. MonthsView) : d'abord ce qui reste à ranger, puis, par catégorie, chaque dépense — son dépensé
 * face à son budget, et ses opérations, qu'on peut ranger ailleurs —, puis ce qui a été écarté.
 */
export default function MonthSpending({ state, month, scope, update, onPlace }: { state: State; month: Month; scope: Scope; update: Update; onPlace: (transaction: Transaction) => void }) {
  // Deux niveaux ouverts : une catégorie (ou un autre regroupement du mois), et dedans une dépense.
  const groups = useOpenLine()
  const lines = useOpenLine()
  const summary = spendingSummary(state, month, scope)
  const row = (t: Transaction) => <TransactionRow key={t.id} transaction={t} state={state} onPlace={onPlace} />
  // Une dépense courante : son dépensé du mois sur son budget du mois. Une dépense à épargner :
  // son payé du mois seul, et dessous l'année glissante, seule jugée.
  const line = (l: SpendingLine) => (
    <DisclosureButton
      key={l.category.id}
      className="line-button"
      open={lines.isOpen(l.category.id)}
      onToggle={lines.toggle(l.category.id)}
      hint={
        l.year ? (
          <>
            Sur {l.year.months} mois : <Delta spent={l.year.spent} budget={l.year.budget} over={l.over} />
          </>
        ) : undefined
      }
      title={
        <span className="line-head">
          <span className="line-name">
            {l.category.icon && <CategoryGlyph icon={l.category.icon} className="line-icon" />}
            {l.category.name}
          </span>
          {l.year ? (
            <span className={`numeric spend-versus${l.over ? ' spend-over' : ''}`}>{formatEuro(l.spent)}</span>
          ) : (
            <Delta spent={l.spent} budget={l.budget} over={l.over} />
          )}
        </span>
      }
    >
      <ul className="tx-list">{l.transactions.map(row)}</ul>
    </DisclosureButton>
  )

  return (
    <div className="spending-month">
      {summary.unsorted.length > 0 && (
        <div className="spending-block">
          <h3>À ranger ({summary.unsorted.length})</h3>
          <p className="field-hint muted">Ranger une opération apprend son marchand : les suivantes s’y rangeront seules.</p>
          <ul className="tx-list">{summary.unsorted.map(row)}</ul>
        </div>
      )}
      {/* Chaque catégorie, un bouton section : repliée, son écart au budget et ses dépassements ; dépliée,
          ses dépenses, chacune un bouton section qui déplie ses opérations. */}
      {(summary.sections.some((section) => section.lines.some(spentIn)) || summary.unplanned.length > 0) && (
        <div className="line-buttons">
          {summary.sections
            .filter((section) => section.lines.some(spentIn))
            .map((section) => (
              <DisclosureButton
                key={section.group.id}
                className="line-button"
                open={groups.isOpen(section.group.id)}
                onToggle={groups.toggle(section.group.id)}
                hint={overIn(section.lines) > 0 ? <OverLabel count={overIn(section.lines)} /> : undefined}
                title={
                  <span className="line-head">
                    <span className="line-name">{section.group.name}</span>
                    <Delta spent={section.spent} budget={section.budget} />
                  </span>
                }
              >
                <div className="line-buttons">{section.lines.filter(spentIn).map(line)}</div>
              </DisclosureButton>
            ))}
          {summary.unplanned.length > 0 && (
            // Sans budget en face : le total compte dans le mois, mais rien n'est « dépassé ».
            <DisclosureButton
              className="line-button"
              open={groups.isOpen('imprevus')}
              onToggle={groups.toggle('imprevus')}
              title={
                <span className="line-head">
                  <span className="line-name">Imprévus hors catégorie</span>
                  <span className="numeric spend-versus">{formatEuro(summary.unplannedTotal)}</span>
                </span>
              }
            >
              <ul className="tx-list">{summary.unplanned.map(row)}</ul>
            </DisclosureButton>
          )}
        </div>
      )}
      {(summary.savings.toSave > 0 || summary.savings.transfers.length > 0) && (
        <div className="spending-block">
          {/* Mettre de côté plus que prévu n'est pas un dépassement : pas d'alerte ici. */}
          <h3 className="spending-head">
            <span>Épargne</span>
            <Delta spent={summary.savings.transferred} budget={summary.savings.toSave} judged={false} />
          </h3>
          <p className="field-hint muted">
            Le versement du mois vers le compte épargne, face à ce qu’il faut mettre de côté. Les dépenses annuelles se jugent sur douze mois : le mois où elles tombent ne
            dépasse pas pour autant.
          </p>
          {summary.savings.transfers.length > 0 ? (
            <ul className="tx-list">{summary.savings.transfers.map(row)}</ul>
          ) : (
            <p className="field-hint muted">Aucun versement vers l’épargne ce mois-ci : rangez le virement en « Versement épargne ».</p>
          )}
          {summary.savings.sections.some((section) => section.lines.some(spentIn)) && (
            <div className="line-buttons savings-groups">
              {summary.savings.sections
                .filter((section) => section.lines.some(spentIn))
                .map((section) => {
                  // La catégorie se juge comme ses dépenses : sur douze mois, vingt-quatre pour un budget sur 2 ans.
                  const yearSpent = section.lines.reduce((s, l) => s + (l.year?.spent ?? 0), 0)
                  const yearBudget = section.lines.reduce((s, l) => s + (l.year?.budget ?? 0), 0)
                  const spans = [...new Set(section.lines.map((l) => l.year?.months ?? 12))].sort((a, b) => a - b)
                  return (
                    <DisclosureButton
                      key={section.group.id}
                      className="line-button"
                      open={groups.isOpen(section.group.id)}
                      onToggle={groups.toggle(section.group.id)}
                      hint={
                        <>
                          Sur {spans.join(' et ')} mois
                          {overIn(section.lines) > 0 && (
                            <>
                              {' · '}
                              <OverLabel count={overIn(section.lines)} />
                            </>
                          )}
                        </>
                      }
                      title={
                        <span className="line-head">
                          <span className="line-name">{section.group.name}</span>
                          <Delta spent={yearSpent} budget={yearBudget} />
                        </span>
                      }
                    >
                      <div className="line-buttons">{section.lines.filter(spentIn).map(line)}</div>
                    </DisclosureButton>
                  )
                })}
            </div>
          )}
        </div>
      )}
      {summary.ignored.length > 0 && (
        <div className="line-buttons">
          <DisclosureButton
            className="line-button"
            open={groups.isOpen('ecartees')}
            onToggle={groups.toggle('ecartees')}
            title={
              <span className="line-head">
                <span className="line-name">Pas des dépenses ({summary.ignored.length})</span>
                <span className="numeric">{formatEuro(summary.ignored.reduce((s, t) => s + t.amount, 0))}</span>
              </span>
            }
          >
            <ul className="tx-list">{summary.ignored.map(row)}</ul>
          </DisclosureButton>
        </div>
      )}
      <div className="form-actions">
        <DeleteButton withLabel label="Supprimer les opérations du mois" confirmLabel={`Confirmer : supprimer les opérations de ${monthLabel(month)}`} onDelete={() => update((s) => removeMonth(s, month, scope))} />
      </div>
    </div>
  )
}

/** Combien de dépenses dépassent, seulement parmi celles qui s'affichent (cf. `spentIn`). */
const overIn = (lines: SpendingLine[]) => lines.filter((line) => line.over && spentIn(line)).length

/** « 2 dépassements », en rouge. */
export function OverLabel({ count }: { count: number }) {
  return (
    <span className="spend-over">
      {count} dépassement{count > 1 ? 's' : ''}
    </span>
  )
}
