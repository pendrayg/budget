import { Button, Checkbox, DeleteButton, FlatSelector, Input, Select, type FlatSelectorOption } from '../ds'
import { useId, useState } from 'react'
import { monthlyAmount, PERIOD_LABELS, PERIOD_SHORT } from '../lib/amount'
import { scheduledDays, scheduleWarning, SCHOOL_ZONES, WEEKDAY_NAMES, WEEKDAY_SHORT, WEEKDAYS } from '../lib/calendar'
import { addCategory, budgetAt, deleteCategory, editCategory, moveCategory, removeVersion, upsertVersion, versionMonthly, versionsOf } from '../lib/budget'
import { createId, formatEuro, nowIso } from '../lib/format'
import { monthLabel } from '../lib/month'
import { projectCategoryIds } from '../lib/projects'
import { scopePrefix, type Scope } from '../lib/scope'
import { sortedGroups } from '../lib/summary'
import type { Amount, CategoryIcon, Month, Period, SchoolZone, State, Weekday } from '../lib/types'
import CategoryGlyph from './CategoryGlyph'
import IconPicker from './IconPicker'
import NumberField from './NumberField'
import PeriodButton from './PeriodButton'

type AmountKind = Period | 'items' | 'days'

const COMMON = 'common'
const toScope = (id: string): Scope => (id === COMMON ? null : id)

/** Les budgets où une dépense peut aller : le commun, puis chacun. */
function scopeOptions(state: State): FlatSelectorOption<string>[] {
  return [{ id: COMMON, label: 'Foyer' }, ...state.people.map((person) => ({ id: person.id, label: person.name || 'Sans nom' }))]
}

const KIND_OPTIONS: FlatSelectorOption<AmountKind>[] = [
  { id: 'monthly', label: PERIOD_SHORT.monthly, ariaLabel: 'Montant mensuel' },
  { id: 'quarterly', label: PERIOD_SHORT.quarterly, ariaLabel: 'Montant trimestriel' },
  { id: 'semiannual', label: PERIOD_SHORT.semiannual, ariaLabel: 'Montant semestriel' },
  { id: 'annual', label: PERIOD_SHORT.annual, ariaLabel: 'Montant annuel' },
  { id: 'biennial', label: PERIOD_SHORT.biennial, ariaLabel: 'Montant sur deux ans' },
  { id: 'items', label: 'Items', ariaLabel: 'Somme d’items' },
  { id: 'days', label: 'Jours', ariaLabel: 'Prix par jour, certains jours de la semaine' },
]

interface DraftItem {
  id: string
  label: string
  amount: number | null
  period: Period
}

const blankItem = (): DraftItem => ({ id: createId(), label: '', amount: null, period: 'monthly' })

interface Draft {
  name: string
  icon: CategoryIcon | undefined
  kind: AmountKind
  value: number | null
  items: DraftItem[]
  /** Pour un prix par jour : les jours de la semaine, et ce qu'on en retire. */
  days: Weekday[]
  skipPublicHolidays: boolean
  /** La zone dont les vacances scolaires sont retirées, ou `null` : on ne les retire pas. */
  schoolZone: SchoolZone | null
  groupId: string
  note: string
  from: Month
}

function draftFrom(state: State, categoryId: string | null, month: Month, groupId: string | undefined): Draft {
  const category = categoryId ? state.categories.find((c) => c.id === categoryId) : undefined
  const version = categoryId ? budgetAt(state, categoryId, month) ?? versionsOf(state, categoryId).at(-1) : undefined
  const amount: Amount = version?.amount ?? { kind: 'monthly', value: 0 }
  return {
    name: category?.name ?? '',
    icon: category?.icon,
    kind: amount.kind === 'none' ? 'monthly' : amount.kind,
    value: amount.kind === 'items' || amount.kind === 'none' ? null : amount.value,
    items: amount.kind === 'items' ? amount.items.map((item) => ({ id: createId(), label: item.label, amount: item.amount, period: item.period ?? 'monthly' })) : [blankItem()],
    // Par défaut, les jours d'école : du lundi au vendredi, hors jours fériés.
    days: amount.kind === 'days' ? amount.days : [1, 2, 3, 4, 5],
    skipPublicHolidays: amount.kind === 'days' ? (amount.skipPublicHolidays ?? false) : true,
    schoolZone: amount.kind === 'days' ? (amount.schoolZone ?? null) : null,
    groupId: version?.groupId ?? groupId ?? state.groups[0]?.id ?? '',
    note: version?.note ?? '',
    from: month,
  }
}

function toAmount(draft: Draft): Amount {
  if (draft.kind === 'items') {
    return { kind: 'items', items: draft.items.filter((item) => item.amount !== null).map((item) => ({ label: item.label.trim(), amount: item.amount ?? 0, ...(item.period !== 'monthly' ? { period: item.period } : {}) })) }
  }
  if (draft.kind === 'days') {
    return {
      kind: 'days',
      value: draft.value ?? 0,
      days: [...draft.days].sort((a, b) => a - b),
      ...(draft.skipPublicHolidays ? { skipPublicHolidays: true } : {}),
      ...(draft.schoolZone ? { schoolZone: draft.schoolZone } : {}),
    }
  }
  return { kind: draft.kind, value: draft.value ?? 0 }
}

/**
 * Le formulaire d'une DÉPENSE (le stockage dit « catégorie », cf. types.ts) : ce qu'elle coûte, à
 * quel rythme, dans quelle catégorie — qui dit comment on la partage et si on l'épargne —, puis
 * sa note et l'historique de ses changements. Chaque changement pose une version à partir du MOIS EN COURS : le
 * budget d'avant ne bouge pas, et l'historique garde chaque changement. Plusieurs modifications dans
 * le même mois n'en font qu'une, la dernière.
 *
 * Le même formulaire sert dans la ligne de la catégorie (bouton section dépliante) et dans la
 * feuille de création. Son brouillon part de la catégorie à son montage : l'app le remonte à chaque
 * ouverture. Une catégorie qui existe s'enregistre au fil de la saisie ; `onDone` suit une création
 * ou une suppression. Une nouvelle dépense naît dans la catégorie `groupId`.
 */
export default function CategoryForm({
  categoryId,
  month,
  state,
  update,
  onDone,
  groupId,
}: {
  groupId?: string
  categoryId: string | null
  month: Month
  state: State
  update: (change: (state: State) => State) => void
  onDone: () => void
}) {
  const uid = useId()
  const [draft, setDraft] = useState<Draft>(() => draftFrom(state, categoryId, month, groupId))
  const [choosingIcon, setChoosingIcon] = useState(false)

  const isNew = categoryId === null
  const isValid = (d: Draft) => d.name.trim() !== '' && state.groups.some((g) => g.id === d.groupId) && (d.kind === 'items' ? d.items.some((item) => item.amount !== null) : d.value !== null && (d.kind !== 'days' || d.days.length > 0))
  const valid = isValid(draft)
  const versions = categoryId ? versionsOf(state, categoryId) : []
  // Le budget de la dépense : le commun, ou celui d'une personne. À plusieurs, elle peut passer de
  // l'un à l'autre, à partir du mois en cours comme tout changement : les mois d'avant restent dans
  // l'ancien. Pas celle d'un projet, qui s'épargne dans le budget du projet.
  const budgetOf = (id: string): Scope => state.groups.find((g) => g.id === id)?.owner ?? null
  const scope = budgetOf(draft.groupId)
  const isProject = categoryId !== null && projectCategoryIds(state).has(categoryId)
  const budgetOptions = state.people.length > 1 && !isProject && !isNew ? scopeOptions(state) : []
  /** Passe la dépense dans un autre budget : dans sa catégorie du même type (à épargner ou non),
   *  sinon sa première, sinon une catégorie qui naît pour elle. */
  const moveTo = (target: Scope) => {
    if (!categoryId || target === scope) return
    const save = state.groups.find((g) => g.id === draft.groupId)?.save ?? false
    const groups = sortedGroups(state, target)
    const groupId = (groups.find((g) => g.save === save) ?? groups[0])?.id ?? `${scopePrefix(target)}${createId()}`
    setDraft({ ...draft, groupId })
    update((current) => moveCategory(current, categoryId, groupId, target, draft.from, nowIso()))
  }
  const groupOptions = sortedGroups(state, scope).map((group) => ({ value: group.id, label: group.name }))
  const groupName = (id: string) => {
    const group = state.groups.find((g) => g.id === id)
    if (!group) return '?'
    const owner = state.people.length > 1 && group.owner ? state.people.find((p) => p.id === group.owner)?.name : undefined
    return owner ? `${group.name} (${owner})` : group.name
  }

  /** Écrit le brouillon : la catégorie (nom, icône) et sa version du mois en cours. */
  const write = (d: Draft) => {
    const now = nowIso()
    const amount = toAmount(d)
    update((current) => {
      const id = categoryId ?? createId()
      // La répartition et l'épargne sont celles de la catégorie : copiées pour les apps d'avant.
      const group = current.groups.find((g) => g.id === d.groupId)
      const version = { categoryId: id, from: d.from, groupId: d.groupId, splitKeyId: group?.splitKeyId ?? 'prorata', amount, save: group?.save ?? false, updatedAt: now, ...(d.note.trim() ? { note: d.note.trim() } : {}) }
      if (isNew) return addCategory(current, { id, name: d.name.trim(), ...(d.icon ? { icon: d.icon } : {}), updatedAt: now }, version)
      return upsertVersion(editCategory(current, id, { name: d.name.trim(), icon: d.icon }, now), version)
    })
  }

  // Une catégorie qui existe s'enregistre à chaque changement, dès que le brouillon est valable :
  // pas de bouton Enregistrer. Une nouvelle attend « Créer », pour ne pas naître à la première lettre.
  const change = (next: Draft) => {
    setDraft(next)
    if (!isNew && isValid(next)) write(next)
  }

  const create = () => {
    write(draft)
    onDone()
  }

  const remove = () => {
    if (!categoryId) return
    update((current) => deleteCategory(current, categoryId))
    onDone()
  }

  return (
    <form
      className="form"
      onSubmit={(event) => {
        event.preventDefault()
        if (isNew && valid) create()
      }}
    >
      <div className="field">
        <label htmlFor={`${uid}-name`}>Nom</label>
        <Input id={`${uid}-name`} value={draft.name} autoFocus={isNew} onChange={(event) => change({ ...draft, name: event.target.value })} />
      </div>

      {/* L'icône, devant le nom dans la ligne : n'importe laquelle des icônes Nerd Font. */}
      <div className="field">
        <span className="field-label">Icône</span>
        <div className="icon-field">
          <Button icon={draft.icon ? undefined : 'plus'} onClick={() => setChoosingIcon(true)}>
            {draft.icon && <CategoryGlyph icon={draft.icon} className="icon-preview" />}
            {draft.icon ? 'Changer' : 'Choisir une icône'}
          </Button>
          {draft.icon && <DeleteButton label="Retirer l’icône" onDelete={() => change({ ...draft, icon: undefined })} />}
        </div>
        {/* Monté le temps du choix seulement : chaque ligne de catégorie a son formulaire, et
            n'a pas à garder un sélecteur caché. */}
        {choosingIcon && <IconPicker value={draft.icon} onPick={(icon) => change({ ...draft, icon })} onClose={() => setChoosingIcon(false)} />}
      </div>

      <div className="field">
        <span className="field-label">Montant</span>
        <FlatSelector label="Périodicité" options={KIND_OPTIONS} multiline value={draft.kind} onChange={(kind) => change({ ...draft, kind })} />
        {draft.kind === 'items' ? (
          <ul className="items">
            {draft.items.map((item, index) => (
              <li className="item-row item-row-period" key={item.id}>
                <Input
                  aria-label={`Libellé de l’item ${index + 1}`}
                  placeholder="Libellé"
                  value={item.label}
                  onChange={(event) => change({ ...draft, items: draft.items.map((i) => (i.id === item.id ? { ...i, label: event.target.value } : i)) })}
                />
                <NumberField
                  id={`${uid}-item-${item.id}`}
                  value={item.amount}
                  placeholder="0,00"
                  onChange={(amount) => change({ ...draft, items: draft.items.map((i) => (i.id === item.id ? { ...i, amount } : i)) })}
                />
                <PeriodButton
                  label={`Périodicité de l’item ${index + 1}`}
                  value={item.period}
                  onChange={(period) => change({ ...draft, items: draft.items.map((i) => (i.id === item.id ? { ...i, period } : i)) })}
                />
                <DeleteButton
                  label={`Retirer l’item ${index + 1}`}
                  disabled={draft.items.length === 1}
                  onDelete={() => change({ ...draft, items: draft.items.filter((i) => i.id !== item.id) })}
                />
              </li>
            ))}
            <li>
              <Button size="sm" icon="plus" onClick={() => change({ ...draft, items: [...draft.items, blankItem()] })}>
                Un item
              </Button>
            </li>
          </ul>
        ) : draft.kind === 'days' ? (
          <DaysField uid={uid} draft={draft} month={month} onChange={change} />
        ) : (
          <NumberField id={`${uid}-value`} value={draft.value} placeholder="0,00" suffix={PERIOD_LABELS[draft.kind]} onChange={(value) => change({ ...draft, value })} />
        )}
      </div>

      {/* Le budget, à plusieurs : passer au commun ou à une autre personne la range dans une
          catégorie de ce budget-là, à partir du mois en cours. */}
      {budgetOptions.length > 1 && (
        <div className="field">
          <span className="field-label">Budget</span>
          <FlatSelector
            label="Budget"
            options={budgetOptions}
            multiline={budgetOptions.length > 3}
            value={scope ?? COMMON}
            onChange={(id) => moveTo(toScope(id))}
          />
        </div>
      )}

      {/* La catégorie dit comment on partage et si on épargne. En changer pose une version :
          les mois d'avant restent dans l'ancienne. */}
      <div className="field">
        <label htmlFor={`${uid}-group`}>Catégorie</label>
        <Select id={`${uid}-group`} options={groupOptions} value={draft.groupId} onChange={(event) => change({ ...draft, groupId: event.target.value })} />
      </div>

      <div className="field">
        <label htmlFor={`${uid}-note`}>Note</label>
        <Input id={`${uid}-note`} value={draft.note} placeholder="Constaté, échéance, rappel…" onChange={(event) => change({ ...draft, note: event.target.value })} />
      </div>
      {versions.length > 0 && (
        <div className="field">
          <span className="field-label">Historique des changements</span>
          <ul className="history">
            {versions
              .slice()
              .reverse()
              .map((version) => (
                <li className="history-row" key={version.from}>
                  <span>{monthLabel(version.from)}</span>
                  <span className="numeric">
                    {version.amount.kind === 'none'
                      ? 'plus budgété'
                      : version.amount.kind === 'days'
                        ? `${formatEuro(version.amount.value)} par jour`
                        : formatEuro(versionMonthly(version, version.from))}
                    <small className="muted"> · {groupName(version.groupId)}</small>
                  </span>
                  <DeleteButton
                    label={`Retirer la version de ${monthLabel(version.from)}`}
                    onDelete={() => {
                      if (!categoryId) return
                      update((current) => removeVersion(current, categoryId, version.from))
                      if (versions.length === 1) onDone()
                    }}
                  />
                </li>
              ))}
          </ul>
        </div>
      )}

      <div className="form-actions">
        {isNew ? (
          <Button tone="primary" type="submit" disabled={!valid}>
            Créer
          </Button>
        ) : (
          <DeleteButton withLabel label="Supprimer la dépense" confirmLabel="Confirmer : supprimer la dépense et son historique" onDelete={remove} />
        )}
      </div>
    </form>
  )
}

/** La liste de la zone dont les vacances scolaires sont retirées : aucune, ou la zone. */
const ZONE_OPTIONS = [{ value: 'none', label: 'aucune' }, ...SCHOOL_ZONES.map((zone) => ({ value: zone, label: zone }))]

/**
 * Un prix par JOUR (cf. lib/calendar.ts) : le prix d'un jour, les jours de la semaine où la dépense
 * revient — des boutons à bascule, un par jour —, et ce qu'on en retire : les jours fériés, et les
 * vacances scolaires d'une zone, choisie sur la ligne même (« Sauf vacances zone [B] »).
 * Dessous, ce que ça donne pour le mois : le nombre de jours et le montant, qui varient d'un mois
 * à l'autre.
 */
function DaysField({ uid, draft, month, onChange }: { uid: string; draft: Draft; month: Month; onChange: (draft: Draft) => void }) {
  const schedule = { days: draft.days, skipPublicHolidays: draft.skipPublicHolidays, ...(draft.schoolZone ? { schoolZone: draft.schoolZone } : {}) }
  const count = scheduledDays(month, schedule)
  const total = monthlyAmount({ kind: 'days', value: draft.value ?? 0, ...schedule }, month)
  const warning = scheduleWarning(month, schedule)
  const toggle = (day: Weekday) => onChange({ ...draft, days: draft.days.includes(day) ? draft.days.filter((d) => d !== day) : [...draft.days, day] })
  return (
    <>
      <NumberField id={`${uid}-value`} value={draft.value} placeholder="0,00" suffix="par jour" onChange={(value) => onChange({ ...draft, value })} />
      <div className="weekday-row" role="group" aria-label="Jours de la semaine">
        {WEEKDAYS.map((day) => {
          const on = draft.days.includes(day)
          return (
            <Button key={day} size="sm" className="weekday" active={on} aria-pressed={on} aria-label={WEEKDAY_NAMES[day]} onClick={() => toggle(day)}>
              {WEEKDAY_SHORT[day]}
            </Button>
          )
        })}
      </div>
      <label className="check-field">
        <Checkbox checked={draft.skipPublicHolidays} onChange={(event) => onChange({ ...draft, skipPublicHolidays: event.target.checked })} />
        Sauf jours fériés
      </label>
      {/* Une phrase à compléter : « Sauf vacances zone [B] ». La liste tient sur la ligne, là où
          quatre choix côte à côte la déborderaient. */}
      <div className="zone-field">
        <label htmlFor={`${uid}-zone`}>Sauf vacances zone</label>
        <Select
          id={`${uid}-zone`}
          options={ZONE_OPTIONS}
          value={draft.schoolZone ?? 'none'}
          onChange={(event) => onChange({ ...draft, schoolZone: event.target.value === 'none' ? null : (event.target.value as SchoolZone) })}
        />
      </div>
      <p className="field-hint muted">
        {draft.days.length === 0
          ? 'Choisissez au moins un jour.'
          : `En ${monthLabel(month).toLowerCase()} : ${count} jour${count > 1 ? 's' : ''}, soit ${formatEuro(total)}.`}
        {warning && ` ${warning}`}
      </p>
    </>
  )
}
