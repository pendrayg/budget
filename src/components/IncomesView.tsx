import { Button, DisclosureButton } from '@pendrayg/neomorphism-design-system'
import { useOpenLine } from '../hooks/useOpenLine'
import { colorOf, colorVar } from '../lib/colors'
import { formatEuro, formatPercent } from '../lib/format'
import { monthRange, shortMonthLabel } from '../lib/month'
import { incomeOf, incomeTotal } from '../lib/prorata'
import { incomeHistory, monthSummary, type MonthSummary } from '../lib/summary'
import type { Month, State } from '../lib/types'
import IncomeChart from './IncomeChart'
import IncomeForm from './IncomeForm'
import Underlined from './Underlined'

/**
 * La feuille `Salaire` : en tête le prorata et ce qu'il donne, dessous les revenus de chacun,
 * mois par mois (de part et d'autre du mois à deux ; en ligne seul ou à plusieurs). Chaque mois est un bouton section dépliante qui
 * porte la saisie de ses revenus ; un mois pas encore saisi se saisit par la feuille, en bas.
 */
export default function IncomesView({
  state,
  month,
  missing,
  update,
  onEnterMonth,
}: {
  state: State
  month: Month
  missing: Month[]
  update: (change: (state: State) => State) => void
  onEnterMonth: (month: Month) => void
}) {
  const lines = useOpenLine()
  const summary = monthSummary(state, month)
  const { prorata } = summary
  // Les mois saisis, du plus récent au plus ancien, jusqu'au mois en cours.
  const entered = state.incomes.map((income) => income.month).sort()
  const chart = incomeHistory(state)
  const charted = chart.length > 1
  const history = entered.length === 0 ? [] : monthRange(entered[0], entered[entered.length - 1] > month ? entered[entered.length - 1] : month).reverse()

  return (
    <>
      {prorata.months.length > 0 && (
        <section className="section">
          <IncomeSummary state={state} summary={summary} charted={charted} />
        </section>
      )}

      {charted && (
        <section className="section" aria-label="Évolution des revenus et du reste à vivre">
          <IncomeChart history={chart} people={state.people} />
        </section>
      )}

      <section className="section">
        {history.length === 0 ? (
          <div className="empty">
            <h2>Aucun revenu saisi</h2>
            <p>Chaque mois, le revenu de chacun en quelques lignes : salaire, allocations, autres.</p>
          </div>
        ) : (
          <div className="line-buttons">
            {history.map((m) => {
              const totals = state.people.map((person) => incomeTotal(incomeOf(state, m, person.id)))
              const incomplete = totals.some((total) => total <= 0)
              const cell = (total: number) => (total > 0 ? formatEuro(total) : '—')
              return (
                <DisclosureButton
                  key={m}
                  className={`line-button${incomplete ? ' line-incomplete' : ''}`}
                  open={lines.isOpen(m)}
                  onToggle={lines.toggle(m)}
                  // À deux, trois colonnes comme la synthèse : le revenu de la première personne à
                  // gauche, le mois au milieu, celui de la seconde à droite. Seul : le mois, puis
                  // son revenu. À trois et plus : le mois, le total du foyer, et chacun en indice.
                  title={
                    state.people.length === 2 ? (
                      <span className="income-cells">
                        <span className="numeric">{cell(totals[0])}</span>
                        <span className="income-month">
                          <span>{shortMonthLabel(m)}</span>
                          {incomplete && <span className="ds-disclosure-hint">À compléter</span>}
                        </span>
                        <span className="numeric">{cell(totals[1])}</span>
                      </span>
                    ) : (
                      <span className="income-cells-row">
                        <span className="income-month">
                          <span>{shortMonthLabel(m)}</span>
                          {incomplete && <span className="ds-disclosure-hint">À compléter</span>}
                        </span>
                        <span className="numeric">{cell(totals.reduce((sum, total) => sum + total, 0))}</span>
                      </span>
                    )
                  }
                  hint={state.people.length > 2 ? state.people.map((person, index) => `${person.name} ${cell(totals[index])}`).join(' · ') : undefined}
                >
                  <IncomeForm key={lines.formKey(m)} month={m} state={state} update={update} />
                </DisclosureButton>
              )
            })}
          </div>
        )}
      </section>

      <section className="section section-actions">
        <Button tone="primary" icon="plus" onClick={() => onEnterMonth(missing[0] ?? month)}>
          Saisir un mois
        </Button>
      </section>
    </>
  )
}

/**
 * La synthèse : la part de chacun au prorata, son revenu moyen (souligné de sa couleur, comme sa
 * ligne du graphique), son taux d'effort et son reste à vivre (pointillé). À deux, chaque chiffre
 * de part et d'autre ; à trois et plus, une ligne par personne ; seul, pas de part — son revenu,
 * son effort, son reste.
 */
function IncomeSummary({ state, summary, charted }: { state: State; summary: MonthSummary; charted: boolean }) {
  const { prorata } = summary
  const people = state.people
  // De quoi juger un effort : un budget commun, ou un budget personnel (seul, il n'y a que lui).
  const budgeted = summary.total > 0 || Object.values(summary.personal).some((total) => total > 0)
  const color = (index: number) => colorVar(colorOf(people, index))
  const effort = (id: string) => (summary.effort[id] === null ? '—' : formatPercent(summary.effort[id] ?? 0))
  const remaining = (id: string, index: number) => (
    <Underlined shown={charted && summary.remaining[id] !== null} color={color(index)} dashed>
      {summary.remaining[id] === null ? '—' : formatEuro(summary.remaining[id] ?? 0)}
    </Underlined>
  )
  const average = (id: string, index: number) => (
    <Underlined shown={charted} color={color(index)}>
      {formatEuro(prorata.averages[id])}
    </Underlined>
  )

  if (people.length > 2) {
    return (
      <div className="summary-card summary-rows" aria-label="Moyennes et prorata">
        {/* L'en-tête des colonnes, que quatre lignes de chiffres ne diraient pas d'elles-mêmes. */}
        <div className="summary-row income-row income-row-head muted" aria-hidden="true">
          <span className="summary-figure">Part</span>
          <span className="summary-figure">Revenu moyen</span>
          {budgeted && <span className="summary-figure">Effort</span>}
          {budgeted && <span className="summary-figure">Reste à vivre</span>}
        </div>
        {people.map((person, index) => (
          <div className="summary-row income-row" key={person.id}>
            <span className="summary-name">{person.name}</span>
            <span className="summary-share">{formatPercent(prorata.shares[person.id])}</span>
            <span className="summary-figure">{average(person.id, index)}</span>
            {budgeted && <span className="summary-figure muted">{effort(person.id)}</span>}
            {budgeted && <span className="summary-figure muted">{remaining(person.id, index)}</span>}
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="summary-card" aria-label="Moyennes et prorata">
      {people.length > 1 && (
        <div className="summary-line summary-line-hero">
          {people.map((person) => (
            <span className="summary-figure" key={person.id}>
              <span className="summary-name">{person.name}</span> {formatPercent(prorata.shares[person.id])}
            </span>
          ))}
        </div>
      )}
      <div className="summary-line summary-line-mid">
        {people.map((person, index) => (
          <span className="summary-figure" key={person.id}>
            {people.length === 1 && <span className="summary-name">Revenu moyen</span>} {average(person.id, index)}
          </span>
        ))}
      </div>
      {budgeted && (
        <>
          <div className="summary-line summary-line-minor muted">
            {people.map((person) => (
              <span className="summary-figure" key={person.id}>
                {people.length === 1 && 'Taux d’effort '}
                {effort(person.id)}
              </span>
            ))}
          </div>
          <div className="summary-line summary-line-minor muted">
            {people.map((person, index) => (
              <span className="summary-figure" key={person.id}>
                {people.length === 1 && 'Reste à vivre '}
                {remaining(person.id, index)}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
