import { Button, DisclosureButton, Notice } from '../ds'
import { useRef, useState } from 'react'
import { useOpenLine } from '../hooks/useOpenLine'
import { colorOf, colorVar } from '../lib/colors'
import { formatEuro, formatPercent, nowIso } from '../lib/format'
import { monthLabel, monthRange, shortMonthLabel } from '../lib/month'
import { isSolo } from '../lib/people'
import { incomeOf, incomeTotal } from '../lib/prorata'
import type { Scope } from '../lib/scope'
import { importStatement, placeTransaction, spendingMonths, spendingSummary, type Placement } from '../lib/spending'
import { parseStatement } from '../lib/statement'
import { incomeHistory, monthSummary, type MonthSummary } from '../lib/summary'
import type { Month, State } from '../lib/types'
import IncomeChart from './IncomeChart'
import IncomeForm from './IncomeForm'
import MonthSpending, { OverLabel } from './MonthSpending'
import PlacementSheet from './PlacementSheet'
import SpendingChart from './SpendingChart'
import Underlined from './Underlined'

/**
 * La seconde ligne d'un mois : à gauche, combien de dépenses dépassent (en rouge) ; calé à droite,
 * sous le revenu de la dernière colonne, combien d'opérations sont à ranger.
 */
function SpendingHint({ over, unsorted }: { over: number; unsorted: number }) {
  return (
    <span className="month-hint">
      <span>{over > 0 && <OverLabel count={over} />}</span>
      {unsorted > 0 && <span className="month-hint-unsorted">{unsorted} à ranger</span>}
    </span>
  )
}

/**
 * LES MOIS : ce qui est entré et ce qui est sorti. En tête le prorata et ce qu'il donne, puis
 * l'évolution des revenus et le remplissage du budget ; dessous, mois par mois, un bouton section
 * dépliante. Replié, il dit les revenus de chacun (de part et d'autre du mois à deux ; en ligne
 * seul ou à plusieurs) et, en seconde ligne, les dépassements et les opérations à ranger. Déplié,
 * il porte la saisie de ses revenus, puis ses dépenses : l'état des lieux du relevé importé.
 *
 * Les revenus sont ceux du foyer ; les dépenses, celles du compte que choisit le sous-menu du bas
 * (cf. App) — le commun, ou celui d'une personne, face à son budget à elle. Un relevé s'importe
 * dans le compte choisi. Un mois pas encore saisi se saisit par la feuille, en bas.
 */
export default function MonthsView({
  state,
  month,
  missing,
  scope,
  update,
  onEnterMonth,
}: {
  state: State
  month: Month
  missing: Month[]
  scope: Scope
  update: (change: (state: State) => State) => void
  onEnterMonth: (month: Month) => void
}) {
  const lines = useOpenLine()
  const summary = monthSummary(state, month)
  const { prorata } = summary
  const chart = incomeHistory(state)
  const charted = chart.length > 1
  // Les mois saisis jusqu'au mois en cours, et ceux qui ont un relevé, du plus récent au plus ancien.
  const entered = state.incomes.map((income) => income.month).sort()
  const incomeMonths = entered.length === 0 ? [] : monthRange(entered[0], entered[entered.length - 1] > month ? entered[entered.length - 1] : month)
  const spent = spendingMonths(state, scope)
  const history = [...new Set([...incomeMonths, ...spent])].sort().reverse()
  const spending = new Map(spent.map((m) => [m, spendingSummary(state, m, scope)]))

  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  // Le message d'un import vaut pour son compte : il ne se montre plus quand on en change.
  const [said, setMessage] = useState<{ scope: Scope; tone: 'ok' | 'warn'; text: string } | null>(null)
  const message = said?.scope === scope ? said : null
  const owner = scope ? state.people.find((person) => person.id === scope) : undefined
  const solo = isSolo(state)
  // Une seule feuille pour ranger, celle de l'opération touchée.
  const [placing, setPlacing] = useState<string | null>(null)
  const placingTransaction = placing ? (state.transactions.find((t) => t.id === placing) ?? null) : null

  async function importFile(file: File) {
    setBusy(true)
    setMessage(null)
    try {
      const { pdfTextItems } = await import('../lib/pdf')
      const statement = parseStatement(await pdfTextItems(file))
      if (statement.length === 0) {
        setMessage({ scope, tone: 'warn', text: 'Aucune opération trouvée : ce PDF n’est pas un relevé BoursoBank lisible.' })
        return
      }
      const now = nowIso()
      const preview = importStatement(state, statement, now, scope)
      update((s) => importStatement(s, statement, now, scope).state)
      const imported = [...new Set(statement.map((l) => l.date.slice(0, 7)))].sort()
      const parts = [`${preview.added} opération${preview.added > 1 ? 's' : ''} ajoutée${preview.added > 1 ? 's' : ''} (${imported.map(monthLabel).join(', ')})`]
      if (preview.added > 0) parts.push(`${preview.unsorted} à ranger`)
      if (preview.duplicates > 0) parts.push(`${preview.duplicates} déjà importée${preview.duplicates > 1 ? 's' : ''}`)
      setMessage({ scope, tone: 'ok', text: `${owner && !solo ? `Compte de ${owner.name} : ` : ''}${parts.join(', ')}.` })
      // Le dernier mois du relevé s'ouvre : c'est là qu'il y a à ranger.
      lines.toggle(imported[imported.length - 1])(true)
    } catch {
      setMessage({ scope, tone: 'warn', text: 'Le relevé n’a pas pu être lu.' })
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

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

      {spent.length > 0 && (
        <section className="section" aria-label="Remplissage du budget par mois">
          <SpendingChart
            points={[...spent].reverse().map((m) => {
              const s = spending.get(m)!
              return { month: m, spent: s.spent, budget: s.budget }
            })}
          />
        </section>
      )}

      <section className="section">
        {history.length === 0 ? (
          <div className="empty">
            <h2>Aucun mois saisi</h2>
            <p>
              Chaque mois, le revenu de chacun en quelques lignes : salaire, allocations, autres. Et en début de mois, le relevé{' '}
              {solo ? 'de votre compte' : owner ? `du compte de ${owner.name}` : 'du compte commun'}, dont les opérations se rangent dans les dépenses du budget.
            </p>
          </div>
        ) : (
          <div className="line-buttons">
            {history.map((m) => {
              const totals = state.people.map((person) => incomeTotal(incomeOf(state, m, person.id)))
              const incomplete = totals.some((total) => total <= 0)
              const cell = (total: number) => (total > 0 ? formatEuro(total) : '—')
              const s = spending.get(m)
              const over = s?.overCount ?? 0
              const unsorted = s?.unsorted.length ?? 0
              const spendingHint = over > 0 || unsorted > 0 ? <SpendingHint over={over} unsorted={unsorted} /> : undefined
              const incomesHint = state.people.length > 2 ? state.people.map((person, index) => `${person.name} ${cell(totals[index])}`).join(' · ') : undefined
              return (
                <DisclosureButton
                  key={m}
                  className={`line-button${incomplete || unsorted > 0 ? ' line-incomplete' : ''}`}
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
                  // La seconde ligne : les dépenses du mois, ce qui dépasse et ce qui reste à ranger.
                  hint={
                    incomesHint && spendingHint ? (
                      <>
                        {incomesHint}
                        {spendingHint}
                      </>
                    ) : (
                      (incomesHint ?? spendingHint)
                    )
                  }
                >
                  <div className="month-parts">
                    <div className="month-part">
                      <h3>Revenus</h3>
                      <IncomeForm key={lines.formKey(m)} month={m} state={state} update={update} />
                    </div>
                    {spending.has(m) && (
                      <div className="month-part">
                        <h3>Dépenses</h3>
                        <MonthSpending key={lines.formKey(m)} state={state} month={m} scope={scope} update={update} onPlace={(t) => setPlacing(t.id)} />
                      </div>
                    )}
                  </div>
                </DisclosureButton>
              )
            })}
          </div>
        )}
      </section>

      {message && (
        <section className="section">
          <Notice tone={message.tone} title={message.text} />
        </section>
      )}

      <section className="section section-actions">
        <Button tone="primary" icon="plus" onClick={() => onEnterMonth(missing[0] ?? month)}>
          Saisir un mois
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void importFile(file)
          }}
        />
        <Button tone="primary" icon="plus" disabled={busy} onClick={() => fileInput.current?.click()}>
          {busy ? 'Lecture du relevé…' : 'Importer un relevé'}
        </Button>
      </section>

      <PlacementSheet
        state={state}
        transaction={placingTransaction}
        onPick={(placement: Placement) => {
          if (placing) update((s) => placeTransaction(s, placing, placement, nowIso()))
        }}
        onClose={() => setPlacing(null)}
      />
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
