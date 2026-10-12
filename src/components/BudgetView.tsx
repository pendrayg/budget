import { Button, Disclosure, DisclosureButton } from '@pendrayg/neomorphism-design-system'
import { useState, type ReactNode } from 'react'
import { formatEuro, formatPercent } from '../lib/format'
import { budgetHistory, monthSummary, type BudgetSection } from '../lib/summary'
import BudgetChart from './BudgetChart'
import type { Month, Person, State } from '../lib/types'
import { useOpenLine } from '../hooks/useOpenLine'
import CategoryForm from './CategoryForm'
import CategorySheet, { type Creating } from './CategorySheet'
import GroupForm from './GroupForm'
import ProrataGapNotice from './ProrataGapNotice'
import { missingForProrata } from '../lib/missing'
import CategoryGlyph from './CategoryGlyph'
import type { Scope } from '../lib/scope'
import { isSolo } from '../lib/people'
import PeopleSummary from './PeopleSummary'

/**
 * La feuille `Mensuels` du classeur : LE budget, celui en vigueur ce mois-ci — pas de navigation
 * de mois en mois. Ce que chacun verse sur le commun, l'évolution du total au fil des
 * modifications, puis les CATÉGORIES (Ratio, Prorata épargné, Prorata mensuel… celles qu'on a
 * créées), chacune une section dépliante. Repliée, une catégorie dit son total et la part de
 * chacun ; dépliée, ses DÉPENSES, chacune un bouton section dépliante qui porte son formulaire,
 * précédées des réglages de la catégorie et suivies du bouton qui en ajoute une. Une seule
 * ligne ouverte à la fois. Chaque modification d'une dépense est historisée à partir du mois où
 * elle est faite.
 *
 * Le sous-menu du bas (cf. App) choisit le budget : le COMMUN, ou celui de l'une des personnes —
 * ses catégories à elle, qu'elle paie seule, sans répartition. Seul, c'est le sien, sans commun.
 */
export default function BudgetView({
  state,
  month,
  scope,
  update,
  onEnterIncome,
}: {
  state: State
  month: Month
  scope: Scope
  update: (change: (state: State) => State) => void
  onEnterIncome: (month: Month) => void
}) {
  // La feuille ne sert qu'à créer : une catégorie ou une dépense qui existe se modifie dans sa ligne.
  const [creating, setCreating] = useState<{ open: boolean; generation: number; what: Creating }>({ open: false, generation: 0, what: { kind: 'group' } })
  const create = (what: Creating) => setCreating((c) => ({ open: true, generation: c.generation + 1, what }))
  const lines = useOpenLine()
  const summary = monthSummary(state, month, scope)
  const history = budgetHistory(state, month, scope)
  const owner = scope ? state.people.find((person) => person.id === scope) : undefined
  const solo = isSolo(state)
  const hasGroups = summary.sections.length > 0
  const hasLines = summary.sections.some((section) => section.lines.length > 0)

  return (
    <>
      <section className="section">
        {!owner && <ProrataGapNotice month={month} missing={missingForProrata(state, month)} span={summary.prorata.span} counted={summary.prorata.months.length} onEnter={onEnterIncome} />}

        {owner ? (
          hasLines && <PersonalSummary state={state} month={month} personId={owner.id} total={summary.total} solo={solo} />
        ) : hasLines ? (
          <PeopleSummary people={state.people} label="Part de chacun" amount={(person) => formatEuro(summary.due[person.id])} detail={(person) => formatPercent(summary.effective[person.id])} />
        ) : null}
        {hasLines ? null : hasGroups ? (
          <div className="empty">
            <h2>Aucune dépense</h2>
            <p>Dépliez une catégorie pour y ajouter une dépense.</p>
          </div>
        ) : (
          <div className="empty">
            <h2>Aucune catégorie</h2>
            <p>
              {owner && !solo
                ? `Les dépenses de ${owner.name}, payées de son compte. Ajoutez-y une catégorie.`
                : 'Ajoutez une catégorie, ou restaurez une sauvegarde depuis les réglages.'}
            </p>
            <Button tone="primary" icon="plus" onClick={() => create({ kind: 'group', owner: scope })}>
              Ajouter une catégorie
            </Button>
          </div>
        )}
      </section>

      {history.length > 0 && (
        <section className="section" aria-label="Évolution du total du budget">
          <BudgetChart history={history} />
        </section>
      )}

      {hasGroups && (
        <div className="budget-sections">
          {summary.sections.map((section) => (
            <SectionBlock
              key={section.group.id}
              section={section}
              personal={owner !== undefined}
              people={state.people}
              lines={lines}
              onAddExpense={() => create({ kind: 'expense', groupId: section.group.id })}
              renderForm={(categoryId) => <CategoryForm key={lines.formKey(categoryId)} categoryId={categoryId} month={month} state={state} update={update} onDone={lines.close} />}
              renderSettings={() => <GroupForm key={lines.formKey(`group-${section.group.id}`)} groupId={section.group.id} month={month} state={state} update={update} onDone={lines.close} />}
            />
          ))}
        </div>
      )}

      {hasGroups && (
        <section className="section section-actions">
          <Button tone="primary" icon="plus" onClick={() => create({ kind: 'group', owner: scope })}>
            Ajouter une catégorie
          </Button>
        </section>
      )}

      <CategorySheet
        open={creating.open}
        creating={creating.what}
        generation={creating.generation}
        month={month}
        state={state}
        update={update}
        onClose={() => setCreating((c) => ({ ...c, open: false }))}
      />
    </>
  )
}

/**
 * Une catégorie : repliée, son total et la part de chacun ; dépliée, ses réglages, ses dépenses
 * et le bouton qui en ajoute une.
 */
function SectionBlock({
  section,
  personal,
  people,
  lines,
  onAddExpense,
  renderForm,
  renderSettings,
}: {
  section: BudgetSection
  personal: boolean
  people: readonly Person[]
  lines: ReturnType<typeof useOpenLine>
  onAddExpense: () => void
  renderForm: (categoryId: string) => ReactNode
  renderSettings: () => ReactNode
}) {
  const { group } = section
  const title = group.name
  const settingsId = `group-${group.id}`
  return (
    <Disclosure
      className="budget-section"
      toggleLabel={`Dépenses : ${title}`}
      // À deux, l'intitulé en trois colonnes, comme la synthèse : la première personne à gauche,
      // la seconde à droite, la section au milieu ; en haut le montant de chacun et le titre,
      // dessous la répartition de chacun et le total. La répartition est celle de la catégorie ce
      // mois-ci : son ratio, ou le prorata. Une catégorie personnelle n'a qu'un montant, que sa
      // personne paie seule : au milieu ; à trois et plus, de même, la part de chacun en dessous.
      title={
        personal || people.length !== 2 ? (
          <span className="budget-section-heading" aria-label={`${title}, ${formatEuro(section.total)}${personal ? '' : ` : ${people.map((person) => `${person.name} ${formatEuro(section.totals[person.id])}`).join(', ')}`}`}>
            <span />
            <span className="budget-section-name">{title}</span>
            <span />
            <span />
            <span className="budget-section-sub budget-section-name budget-section-total">{formatEuro(section.total)}</span>
            <span />
            {!personal && (
              <span className="budget-section-people">
                {people.map((person) => (
                  <span key={person.id} className="numeric">
                    <span className="muted">{person.name}</span> {formatEuro(section.totals[person.id])} <span className="muted">{formatPercent(section.shares[person.id] ?? 0)}</span>
                  </span>
                ))}
              </span>
            )}
          </span>
        ) : (
          <span className="budget-section-heading" aria-label={`${title}, ${formatEuro(section.total)} : ${people[0].name} ${formatEuro(section.totals[people[0].id])}, ${people[1].name} ${formatEuro(section.totals[people[1].id])}`}>
            <span className="numeric">{formatEuro(section.totals[people[0].id])}</span>
            <span className="budget-section-name">{title}</span>
            <span className="numeric">{formatEuro(section.totals[people[1].id])}</span>
            <span className="budget-section-sub numeric">{formatPercent(section.shares[people[0].id] ?? 0)}</span>
            <span className="budget-section-sub budget-section-name budget-section-total">{formatEuro(section.total)}</span>
            <span className="budget-section-sub numeric">{formatPercent(section.shares[people[1].id] ?? 0)}</span>
          </span>
        )
      }
    >
      {/* Les réglages de la catégorie, en premier : son nom, sa répartition, l'épargne. */}
      <div className="line-buttons group-settings">
        <DisclosureButton
          className="line-button"
          icon="cog"
          open={lines.isOpen(settingsId)}
          onToggle={lines.toggle(settingsId)}
          title="Réglages de la catégorie"
        >
          {renderSettings()}
        </DisclosureButton>
      </div>
      {/* Chaque dépense, un bouton section dépliante : l'en-tête dit son nom et son mensuel, le
          dépli porte son formulaire. */}
      <div className="line-buttons">
        {section.lines.map((line) => (
          <DisclosureButton
            key={line.category.id}
            className="line-button"
            open={lines.isOpen(line.category.id)}
            onToggle={lines.toggle(line.category.id)}
            title={
              <span className="line-head">
                <span className="line-name">
                  {line.category.icon && <CategoryGlyph icon={line.category.icon} className="line-icon" />}
                  {line.category.name}
                </span>
                <span className="numeric">{formatEuro(line.monthly)}</span>
              </span>
            }
          >
            {renderForm(line.category.id)}
          </DisclosureButton>
        ))}
      </div>
      <div className="section-actions group-add">
        <Button icon="plus" onClick={onAddExpense}>
          Ajouter une dépense
        </Button>
      </div>
    </Disclosure>
  )
}

/**
 * La synthèse du budget d'une personne : son total, la part de son revenu qu'il prend, et ce qui
 * lui reste une fois versée sa part du commun et payé son budget — sur son revenu moyen, comme le
 * reste à vivre de l'écran Revenus.
 */
function PersonalSummary({ state, month, personId, total, solo }: { state: State; month: Month; personId: string; total: number; solo: boolean }) {
  const common = monthSummary(state, month)
  const income = common.prorata.averages[personId] ?? 0
  return (
    <div className="summary-card summary-split" aria-label="Budget personnel">
      <div className="summary-person">
        <span className="summary-name">Budget</span>
        <span className="summary-amount">{formatEuro(total)}</span>
        {income > 0 && <span className="summary-share muted">{formatPercent(total / income)} du revenu</span>}
      </div>
      {income > 0 && (
        <div className="summary-person">
          <span className="summary-name">Reste à vivre</span>
          <span className="summary-amount">{formatEuro(common.remaining[personId] ?? 0)}</span>
          <span className="summary-share muted">{solo ? 'après ce budget' : 'après le commun et ce budget'}</span>
        </div>
      )}
    </div>
  )
}
