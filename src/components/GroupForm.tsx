import { Button, DeleteButton, FlatSelector, Input, Selectable, SelectToggle } from '../ds'
import { useId, useState } from 'react'
import { addGroup, deleteGroup, editGroup, setGroupShares } from '../lib/budget'
import { createId, formatPercent, nowIso } from '../lib/format'
import { fixedSharesAt } from '../lib/prorata'
import { scopePrefix } from '../lib/scope'
import type { Month, Person, Shares, State } from '../lib/types'
import NumberField from './NumberField'

type SplitKind = 'prorata' | 'ratio'

const SPLIT_OPTIONS = [
  { id: 'prorata' as const, label: 'Prorata', ariaLabel: 'Au prorata des revenus' },
  { id: 'ratio' as const, label: 'Ratio', ariaLabel: 'À un ratio fixe' },
]

/** Les parts, en pour cent, de toutes les personnes sauf la dernière, qui a le reste. */
type Percents = Record<string, number | null>

/** Le reste de la dernière personne, en pour cent ; `null` si une part manque ou si ça déborde. */
function remainder(people: readonly Person[], percents: Percents): number | null {
  let sum = 0
  for (const person of people.slice(0, -1)) {
    const value = percents[person.id]
    if (value === null || value === undefined || value < 0 || value > 100) return null
    sum += value
  }
  const rest = Math.round((100 - sum) * 10) / 10
  return rest < 0 ? null : rest
}

/** Les parts de chacun, de 0 à 1, d'après les pour cent ; `null` tant qu'elles ne sont pas valables. */
function sharesOf(people: readonly Person[], percents: Percents): Shares | null {
  const rest = remainder(people, percents)
  if (rest === null) return null
  const last = people[people.length - 1]
  return Object.fromEntries(people.map((person) => [person.id, person.id === last.id ? rest / 100 : (percents[person.id] ?? 0) / 100]))
}

/**
 * Le ratio d'une catégorie : un champ par personne sauf la dernière, qui a le reste — à deux,
 * « Part d'Alice », et Bruno a le reste.
 */
function RatioFields({ id, people, percents, onChange }: { id: string; people: readonly Person[]; percents: Percents; onChange: (percents: Percents) => void }) {
  const rest = remainder(people, percents)
  const last = people[people.length - 1]
  return (
    <>
      {people.slice(0, -1).map((person) => (
        <NumberField key={person.id} id={`${id}-${person.id}`} label={`Part de ${person.name}`} suffix="%" value={percents[person.id] ?? null} onChange={(value) => onChange({ ...percents, [person.id]: value })} />
      ))}
      <p className="field-hint muted">
        {last.name} a le reste{rest !== null ? ` : ${formatPercent(rest / 100)}` : ''}.
      </p>
    </>
  )
}

/**
 * Une CATÉGORIE de l'écran (le stockage dit `group`, cf. types.ts) : son nom, sa répartition — au
 * prorata des revenus, ou à un ratio fixe — et si ses dépenses sont à épargner.
 *
 * Nouvelle (`groupId` nul), elle attend « Créer » et sa répartition se choisit. Existante, elle
 * s'enregistre au fil de la saisie, sans date à donner ; sa répartition ne change plus de nature
 * (ce serait réécrire le partage de tous ses mois passés), mais un ratio changé vaut à partir du
 * mois en cours, les mois d'avant gardant le leur.
 *
 * Une catégorie PERSONNELLE (`owner`, ou celui de la catégorie) n'a pas de répartition : sa
 * personne paie tout.
 */
export default function GroupForm({
  groupId,
  owner = null,
  month,
  state,
  update,
  onDone,
}: {
  groupId: string | null
  /** Pour une nouvelle catégorie : la personne dont c'est le budget, `null` pour le commun. */
  owner?: string | null
  month: Month
  state: State
  update: (change: (state: State) => State) => void
  onDone: () => void
}) {
  const uid = useId()
  const group = groupId ? state.groups.find((g) => g.id === groupId) : undefined
  const key = group ? state.splitKeys.find((k) => k.id === group.splitKeyId) : undefined
  const fixedKey = key?.kind === 'fixed' ? key : undefined
  const personal = group ? (group.owner ?? null) : owner

  const [name, setName] = useState(group?.name ?? '')
  const [save, setSave] = useState(group?.save ?? false)
  const [kind, setKind] = useState<SplitKind>(fixedKey ? 'ratio' : 'prorata')
  const sharesNow = fixedKey ? fixedSharesAt(fixedKey, month) : null
  // Les pour cent de chacun sauf la dernière personne : les siens, ou à parts égales.
  const [percents, setPercents] = useState<Percents>(() =>
    Object.fromEntries(state.people.slice(0, -1).map((person) => [person.id, sharesNow ? Math.round((sharesNow[person.id] ?? 0) * 1000) / 10 : Math.round(1000 / state.people.length) / 10])),
  )

  const isNew = !group
  const ratio = sharesOf(state.people, percents)
  const valid = name.trim() !== '' && (personal !== null || kind === 'prorata' || ratio !== null)
  const expenses = group ? new Set(state.budgets.filter((v) => v.groupId === group.id).map((v) => v.categoryId)).size : 0

  // Existante, elle s'enregistre à chaque changement de nom ou d'épargne, dès que le nom n'est pas vide.
  const write = (next: { name: string; save: boolean }) => {
    if (!group || next.name.trim() === '') return
    update((s) => editGroup(s, group.id, { name: next.name.trim(), save: next.save }, nowIso()))
  }

  const create = () => {
    const now = nowIso()
    if (personal) update((s) => addGroup(s, { id: `${scopePrefix(personal)}${createId()}`, name: name.trim(), save, owner: personal, updatedAt: now }, null))
    else update((s) => addGroup(s, { id: createId(), name: name.trim(), save, updatedAt: now }, kind === 'ratio' ? ratio : null))
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
        <Input
          id={`${uid}-name`}
          value={name}
          autoFocus={isNew}
          placeholder={personal ? 'Loisirs, Vêtements…' : 'Prorata mensuel, Ratio…'}
          onChange={(event) => {
            setName(event.target.value)
            write({ name: event.target.value, save })
          }}
        />
      </div>

      {personal === null && (
        <div className="field">
          <span className="field-label">Répartition</span>
          {isNew ? (
            <>
              <FlatSelector label="Répartition" options={SPLIT_OPTIONS} value={kind} onChange={setKind} />
              {kind === 'ratio' ? (
                <RatioFields id={`${uid}-share`} people={state.people} percents={percents} onChange={setPercents} />
              ) : (
                <p className="field-hint muted">Au prorata des revenus de chacun, mois après mois.</p>
            )}
          </>
        ) : fixedKey ? (
          <RatioFields
            id={`${uid}-share`}
            people={state.people}
            percents={percents}
            onChange={(next) => {
              setPercents(next)
              // Enregistré au fil de la saisie, à partir du mois en cours : les mois d'avant
              // gardent leur ratio, comme les dépenses gardent leur montant.
              const shares = sharesOf(state.people, next)
              if (shares) update((s) => setGroupShares(s, group.id, month, shares, nowIso()))
            }}
          />
        ) : (
          <p className="field-hint muted">Au prorata des revenus de chacun, mois après mois.</p>
        )}
      </div>
      )}

      {/* La sélection du DS : le bloc s'enfonce quand il est choisi, du geste de son bouton. */}
      <Selectable selected={save} className="choice">
        <div className="choice-text">
          <strong>À épargner</strong>
        </div>
        <SelectToggle
          selected={save}
          onToggle={() => {
            setSave(!save)
            write({ name, save: !save })
          }}
          label="À épargner"
        />
      </Selectable>

      <div className="form-actions">
        {isNew ? (
          <Button tone="primary" type="submit" disabled={!valid}>
            Créer
          </Button>
        ) : (
          <DeleteButton
            withLabel
            label="Supprimer la catégorie"
            confirmLabel={expenses > 0 ? `Confirmer : supprimer la catégorie et ses ${expenses > 1 ? `${expenses} dépenses` : 'dépense'}` : 'Confirmer : supprimer la catégorie'}
            onDelete={() => {
              update((s) => deleteGroup(s, group.id))
              onDone()
            }}
          />
        )}
      </div>
    </form>
  )
}
