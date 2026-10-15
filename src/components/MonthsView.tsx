import { Button, DisclosureButton, Notice } from '../ds'
import { useRef, useState } from 'react'
import { useOpenLine } from '../hooks/useOpenLine'
import { formatEuro, formatPercent, nowIso } from '../lib/format'
import { monthLabel, monthRange, shortMonthLabel } from '../lib/month'
import { isSolo } from '../lib/people'
import { incomeOf, incomeTotal } from '../lib/prorata'
import type { Scope } from '../lib/scope'
import { importStatement, placeTransaction, spendingMonths, spendingSummary, type Placement } from '../lib/spending'
import { parseStatement } from '../lib/statement'
import { incomeHistory, monthSummary, type MonthSummary } from '../lib/summary'
import type { Month, Person, State } from '../lib/types'
import IncomeForm from './IncomeForm'
import MonthSpending, { OverLabel } from './MonthSpending'
import PlacementSheet from './PlacementSheet'
import SpendingChart, { type FillPoint } from './SpendingChart'

/**
 * La seconde ligne d'un mois : à gauche, combien de dépenses dépassent (en rouge) ; calé à droite,
 * sous les revenus, combien d'opérations sont à ranger.
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
 * Les revenus d'un mois sur le commun : ceux de chacun, et leur somme, ceux du foyer. Ils se
 * saisissent sur le compte de chaque personne, que choisit le sous-menu du bas.
 */
function IncomeRecap({ people, totals }: { people: Person[]; totals: number[] }) {
  const cell = (total: number) => (total > 0 ? formatEuro(total) : '—')
  return (
    <div className="income-recap">
      <ul className="income-recap-list">
        {people.map((person, index) => (
          <li className="line-head" key={person.id}>
            <span>{person.name}</span>
            <span className="numeric">{cell(totals[index])}</span>
          </li>
        ))}
        <li className="line-head income-recap-total">
          <span>Foyer</span>
          <span className="numeric">{formatEuro(totals.reduce((sum, total) => sum + total, 0))}</span>
        </li>
      </ul>
      <p className="field-hint muted">Les revenus de chacun se saisissent sur son compte : choisissez-le dans le sous-menu du bas.</p>
    </div>
  )
}

/**
 * LES MOIS : ce qui est entré et ce qui est sorti. En tête le prorata et ce qu'il donne, puis un
 * graphique, le remplissage du budget et les revenus en pointillé ; dessous, mois par mois, un bouton section
 * dépliante. Replié, il dit ses revenus et, en seconde ligne, les dépassements et les opérations
 * à ranger. Déplié, ses revenus, puis ses dépenses : l'état des lieux du relevé importé.
 *
 * Tout suit le compte que choisit le sous-menu du bas (cf. App). Sur le COMMUN, les revenus sont
 * ceux du foyer — leur somme, chacun détaillé au dépli — et les dépenses celles du compte commun.
 * Sur le compte d'une PERSONNE, ses revenus à elle, qui se saisissent là, et ses dépenses, face à
 * son budget. Un relevé s'importe dans le compte choisi ; un mois pas encore saisi se saisit par la
 * feuille, en bas.
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
  onEnterMonth: (month: Month, person?: string) => void
}) {
  const lines = useOpenLine()
  const summary = monthSummary(state, month)
  const { prorata } = summary
  // Les mois saisis jusqu'au mois en cours, et ceux qui ont un relevé, du plus récent au plus ancien.
  const entered = state.incomes.map((income) => income.month).sort()
  const incomeMonths = entered.length === 0 ? [] : monthRange(entered[0], entered[entered.length - 1] > month ? entered[entered.length - 1] : month)
  const spent = spendingMonths(state, scope)
  const history = [...new Set([...incomeMonths, ...spent])].sort().reverse()
  const spending = new Map(spent.map((m) => [m, spendingSummary(state, m, scope)]))

  // Le graphique : chaque mois qui a un revenu ou un relevé. Les revenus et le reste à vivre sont
  // ceux du compte choisi : d'une personne, ou du foyer — leur somme, tant que personne ne manque.
  const incomes = new Map(incomeHistory(state).map((point) => [point.month, point]))
  const pick = (values: Record<string, number | null>): number | null => {
    if (scope) return values[scope] ?? null
    const all = state.people.map((person) => values[person.id] ?? null)
    return all.some((value) => value === null) ? null : all.reduce<number>((sum, value) => sum + (value ?? 0), 0)
  }
  const chartMonths = [...new Set([...incomes.keys(), ...spent])].sort()
  const chartPoints: FillPoint[] =
    spent.length > 0 || chartMonths.length > 1
      ? chartMonths.map((m) => {
          const s = spending.get(m)
          const income = incomes.get(m)
          return { month: m, spent: s?.spent ?? null, budget: s?.budget ?? null, income: income ? pick(income.income) : null, remaining: income ? pick(income.remaining) : null }
        })
      : []

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
          <IncomeSummary state={state} summary={summary} scope={scope} />
        </section>
      )}

      {chartPoints.length > 0 && (
        <section className="section" aria-label="Revenus, dépenses et budget par mois">
          <SpendingChart points={chartPoints} />
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
              const cell = (total: number) => (total > 0 ? formatEuro(total) : '—')
              // Sur le commun, les revenus du foyer : leur somme, à compléter tant qu'il en manque un.
              // Sur le compte d'une personne, les siens.
              const own = scope ? totals[state.people.findIndex((person) => person.id === scope)] : undefined
              const incomplete = own === undefined ? totals.some((total) => total <= 0) : own <= 0
              const shown = own ?? totals.reduce((sum, total) => sum + total, 0)
              const s = spending.get(m)
              const over = s?.overCount ?? 0
              const unsorted = s?.unsorted.length ?? 0
              return (
                <DisclosureButton
                  key={m}
                  className={`line-button${incomplete || unsorted > 0 ? ' line-incomplete' : ''}`}
                  open={lines.isOpen(m)}
                  onToggle={lines.toggle(m)}
                  // Le mois à gauche, ses revenus à droite ; dessous, ses dépenses : ce qui dépasse et
                  // ce qui reste à ranger.
                  title={
                    <span className="income-cells-row">
                      <span className="income-month">
                        <span>{shortMonthLabel(m)}</span>
                        {incomplete && <span className="ds-disclosure-hint">À compléter</span>}
                      </span>
                      <span className="numeric">{cell(shown)}</span>
                    </span>
                  }
                  hint={over > 0 || unsorted > 0 ? <SpendingHint over={over} unsorted={unsorted} /> : undefined}
                >
                  <div className="month-parts">
                    <div className="month-part">
                      <h3>Revenus</h3>
                      {scope ? (
                        <IncomeForm key={lines.formKey(m)} month={m} person={scope} state={state} update={update} />
                      ) : (
                        <IncomeRecap people={state.people} totals={totals} />
                      )}
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
        <Button tone="primary" icon="plus" onClick={() => onEnterMonth(missing[0] ?? month, scope ?? undefined)}>
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

/** « de Bruno », « d’Alice » : l'élision devant une voyelle ou un h muet. */
function of(name: string): string {
  return /^[aeiouyhàâäéèêëîïôöùûü]/i.test(name) ? `d’${name}` : `de ${name}`
}

/**
 * La synthèse, en lignes : le libellé à gauche, la valeur à droite. Elle suit le compte que
 * choisit le sous-menu du bas. Sur le COMMUN, la part de chacun au prorata, puis le foyer : son
 * revenu moyen (la somme de ceux de chacun), son taux d'effort (ce qu'il verse au commun et paie
 * de budgets personnels, sur ce revenu) et son reste à vivre (la somme de ceux de chacun). Sur le
 * compte d'une PERSONNE, ou seul : sa part, son revenu moyen, son effort, son reste. Effort et
 * reste ne se disent qu'une fois un budget saisi.
 */
function IncomeSummary({ state, summary, scope }: { state: State; summary: MonthSummary; scope: Scope }) {
  const { prorata } = summary
  const people = state.people
  // De quoi juger un effort : un budget commun, ou un budget personnel (seul, il n'y a que lui).
  const budgeted = summary.total > 0 || Object.values(summary.personal).some((total) => total > 0)
  const person = scope ? people.find((p) => p.id === scope) : undefined
  const counted = person ? [person] : people
  const average = counted.reduce((sum, p) => sum + (prorata.averages[p.id] ?? 0), 0)
  const paid = counted.reduce((sum, p) => sum + (summary.due[p.id] ?? 0) + (summary.personal[p.id] ?? 0), 0)
  const remainders = counted.map((p) => summary.remaining[p.id]).filter((value): value is number => value !== null && value !== undefined)
  const rows: Array<{ label: string; value: string }> = [
    ...(people.length > 1 ? counted.map((p) => ({ label: `Part ${of(p.name)}`, value: formatPercent(prorata.shares[p.id] ?? 0) })) : []),
    { label: person ? 'Revenu moyen' : 'Revenu moyen du foyer', value: formatEuro(average) },
    ...(budgeted
      ? [
          { label: 'Taux d’effort', value: average > 0 ? formatPercent(paid / average) : '—' },
          { label: 'Reste à vivre', value: remainders.length > 0 ? formatEuro(remainders.reduce((sum, value) => sum + value, 0)) : '—' },
        ]
      : []),
  ]
  return (
    <dl className="figures" aria-label="Moyennes et prorata">
      {rows.map((row) => (
        <div className="figure-row" key={row.label}>
          <dt>{row.label}</dt>
          <dd className="numeric">{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}
