import { Button, DeleteButton, Input, Select } from '@pendrayg/neomorphism-design-system'
import { useId, useState } from 'react'
import { budgetAt } from '../lib/budget'
import { createId, formatEuro, nowIso } from '../lib/format'
import { currentMonth, monthLabel } from '../lib/month'
import { scopePrefix, type Scope } from '../lib/scope'
import { activateProject, deleteProject, isProjectSaving, projectGroup, projectMonthly, projectSaved, stopProject, syncProjectBudget } from '../lib/projects'
import { sortedGroups } from '../lib/summary'
import type { CategoryIcon, Month, State } from '../lib/types'
import IconPicker from './IconPicker'
import ProjectGlyph from './ProjectGlyph'
import MonthInput from './MonthInput'
import NumberField from './NumberField'

interface Line {
  id: string
  label: string
  amount: number | null
}

interface Draft {
  name: string
  icon: CategoryIcon | undefined
  target: Month | ''
  lines: Line[]
}

function draftFor(state: State, projectId: string | null): Draft {
  const project = projectId ? state.projects.find((p) => p.id === projectId) : undefined
  const lines = (project?.items ?? []).map((item) => ({ id: item.id, label: item.label, amount: item.amount as number | null }))
  return { name: project?.name ?? '', icon: project?.icon, target: project?.target ?? '', lines: lines.length > 0 ? lines : [{ id: createId(), label: '', amount: null }] }
}

/** « de mars 2027 », « d’octobre 2026 ». */
function fromMonth(month: Month): string {
  const label = monthLabel(month).toLowerCase()
  return /^[aeiou]/.test(label) ? `d’${label}` : `de ${label}`
}

/** Les catégories à épargner où un projet peut s'épargner : celles de son périmètre. */
function saveGroupOptions(state: State, scope: Scope): { value: string; label: string }[] {
  return sortedGroups(state, scope)
    .filter((group) => group.save)
    .map((group) => ({ value: group.id, label: group.name }))
}

/**
 * Le formulaire d'un projet : son nom, ses lignes, leur total. Le même sert dans la ligne du
 * projet (bouton section dépliante) et dans la feuille de création ; son brouillon part du projet à
 * son montage, et l'app le remonte à chaque ouverture. Un projet qui existe s'enregistre au fil de la
 * saisie ; un nouveau, par « Créer ».
 *
 * Avec une date cible, un projet qui existe peut s'ÉPARGNER dans le budget : on choisit une
 * catégorie à épargner, il y devient une dépense dont la mensualité mène son total à la cible
 * (cf. `src/lib/projects.ts`). Le modifier ensuite recale cette mensualité, à partir du mois en cours.
 */
export default function ProjectForm({
  projectId,
  state,
  scope,
  update,
  onDone,
}: {
  projectId: string | null
  state: State
  /** Le périmètre choisi : celui d'un nouveau projet. Un projet qui existe garde le sien. */
  scope: Scope
  update: (change: (state: State) => State) => void
  onDone: () => void
}) {
  const uid = useId()
  const [draft, setDraft] = useState(() => draftFor(state, projectId))
  const [choosingIcon, setChoosingIcon] = useState(false)
  const month = currentMonth()
  const project = projectId ? state.projects.find((p) => p.id === projectId) : undefined
  const owner: Scope = project ? (project.owner ?? null) : scope
  const groupOptions = saveGroupOptions(state, owner)
  // Où créer la catégorie à épargner qui manque : seul, « au budget » suffit.
  const ownerName = state.people.find((person) => person.id === owner)?.name
  const budgetName = state.people.length === 1 ? 'au budget' : ownerName ? `au budget de ${ownerName}` : 'au budget commun'
  const [groupId, setGroupId] = useState(groupOptions[0]?.value ?? '')

  const isNew = projectId === null
  const total = draft.lines.reduce((sum, line) => sum + (line.amount ?? 0), 0)
  const valid = draft.name.trim() !== ''

  const write = (d: Draft) => {
    const now = nowIso()
    update((current) => {
      const id = projectId ?? `${scopePrefix(owner)}${createId()}`
      const previous = current.projects.find((p) => p.id === id)
      const next = {
        id,
        name: d.name.trim(),
        ...(d.icon ? { icon: d.icon } : {}),
        items: d.lines.filter((line) => line.amount !== null || line.label.trim() !== '').map((line) => ({ id: line.id, label: line.label.trim(), amount: line.amount ?? 0 })),
        ...(d.target ? { target: d.target } : {}),
        ...(previous?.budget ? { budget: previous.budget } : {}),
        ...(owner ? { owner } : {}),
        updatedAt: now,
      }
      const written = { ...current, projects: [...current.projects.filter((p) => p.id !== id), next] }
      // Épargné en ce moment : sa dépense suit le projet (nom, total, cible).
      return isProjectSaving(current, next, month) ? syncProjectBudget(written, id, month, now) : written
    })
  }

  // Un projet qui existe s'enregistre à chaque changement (nom non vide) ; un nouveau attend « Créer ».
  const change = (next: Draft) => {
    setDraft(next)
    if (!isNew && next.name.trim() !== '') write(next)
  }

  return (
    <form
      className="form"
      onSubmit={(event) => {
        event.preventDefault()
        if (isNew && valid) {
          write(draft)
          onDone()
        }
      }}
    >
      <div className="field">
        <label htmlFor={`${uid}-name`}>Nom</label>
        <Input id={`${uid}-name`} value={draft.name} autoFocus={isNew} onChange={(event) => change({ ...draft, name: event.target.value })} />
      </div>
      {/* L'icône, après la grue de tous les projets : n'importe laquelle des icônes Nerd Font. */}
      <div className="field">
        <span className="field-label">Icône</span>
        <div className="icon-field">
          <Button onClick={() => setChoosingIcon(true)}>
            <ProjectGlyph icon={draft.icon} className="icon-preview" />
            {draft.icon ? 'Changer' : 'Choisir une icône'}
          </Button>
          {draft.icon && <DeleteButton label="Retirer l’icône" onDelete={() => change({ ...draft, icon: undefined })} />}
        </div>
        {choosingIcon && <IconPicker value={draft.icon} onPick={(icon) => change({ ...draft, icon })} onClose={() => setChoosingIcon(false)} />}
      </div>
      <div className="field">
        <label htmlFor={`${uid}-target`}>Date cible</label>
        {/* Le sélecteur de mois natif ; vide, le projet n'a pas de cible. Celui d'iOS ne sait pas
            se vider : la corbeille retire la date. */}
        <div className="target-field">
          <MonthInput id={`${uid}-target`} value={draft.target} placeholder="Aucune" onChange={(target) => change({ ...draft, target })} />
          {draft.target && <DeleteButton label="Retirer la date cible" onDelete={() => change({ ...draft, target: '' })} />}
        </div>
      </div>
      <ul className="items">
        {draft.lines.map((line, index) => (
          <li className="item-row item-row-narrow" key={line.id}>
            <Input aria-label={`Libellé de la ligne ${index + 1}`} placeholder="Libellé" value={line.label} onChange={(event) => change({ ...draft, lines: draft.lines.map((l) => (l.id === line.id ? { ...l, label: event.target.value } : l)) })} />
            <NumberField id={`${uid}-${line.id}`} value={line.amount} placeholder="0,00" onChange={(amount) => change({ ...draft, lines: draft.lines.map((l) => (l.id === line.id ? { ...l, amount } : l)) })} />
            <DeleteButton label={`Retirer la ligne ${index + 1}`} disabled={draft.lines.length === 1} onDelete={() => change({ ...draft, lines: draft.lines.filter((l) => l.id !== line.id) })} />
          </li>
        ))}
        <li className="items-foot">
          <Button size="sm" icon="plus" onClick={() => change({ ...draft, lines: [...draft.lines, { id: createId(), label: '', amount: null }] })}>
            Une ligne
          </Button>
          <span className="numeric">
            Total <strong>{formatEuro(total)}</strong>
          </span>
        </li>
      </ul>
      {project && (
        <ProjectSaving
          state={state}
          projectId={project.id}
          month={month}
          total={total}
          target={draft.target}
          groupOptions={groupOptions}
          budgetName={budgetName}
          groupId={groupId}
          onGroup={setGroupId}
          update={update}
        />
      )}
      <div className="form-actions">
        {isNew && (
          <Button tone="primary" type="submit" disabled={!valid}>
            Créer
          </Button>
        )}
        {!isNew && (
          <DeleteButton
            withLabel
            label="Supprimer le projet"
            onDelete={() => {
              // Épargné, sa dépense s'arrête ce mois-ci : son histoire reste au budget.
              if (projectId) update((current) => deleteProject(current, projectId, month, nowIso()))
              onDone()
            }}
          />
        )}
      </div>
    </form>
  )
}

/**
 * L'épargne d'un projet dans le budget. Pas encore épargné : la catégorie à épargner où le mettre,
 * la mensualité que ça donnerait, et « Commencer à épargner ». Épargné : sa catégorie, sa
 * mensualité et ce qui est déjà de côté, et « Arrêter ». Arrêté (ou sa cible passée) : ce qui est
 * de côté, et « Reprendre » tant que la cible est devant.
 */
function ProjectSaving({
  state,
  projectId,
  month,
  total,
  target,
  groupOptions,
  budgetName,
  groupId,
  onGroup,
  update,
}: {
  state: State
  projectId: string
  month: Month
  total: number
  target: Month | ''
  groupOptions: { value: string; label: string }[]
  /** « au budget commun », « au budget de Bruno » : là où créer la catégorie qui manque. */
  budgetName: string
  groupId: string
  onGroup: (groupId: string) => void
  update: (change: (state: State) => State) => void
}) {
  const uid = useId()
  const project = state.projects.find((p) => p.id === projectId)
  if (!project) return null
  const saving = isProjectSaving(state, project, month)
  const saved = projectSaved(state, project, month)
  const group = projectGroup(state, project)
  const current = project.budget ? budgetAt(state, project.budget.categoryId, month) : undefined
  const monthly = current && current.amount.kind === 'monthly' ? current.amount.value : 0
  const reachable = target !== '' && target >= month && total > 0
  const preview = reachable ? projectMonthly(total, saved, month, target) : 0
  const why = target === '' ? 'Donnez-lui une date cible pour l’épargner.' : target < month ? 'Sa date cible est passée.' : total <= 0 ? 'Ajoutez-lui des lignes chiffrées.' : null

  return (
    <div className="field project-saving">
      <span className="field-label">Épargner dans le budget</span>
      {saving ? (
        <>
          <p className="field-hint muted">
            Dans <strong>{group?.name}</strong> : {formatEuro(monthly)} par mois jusqu’en {monthLabel(project.target ?? month).toLowerCase()}. Déjà de côté : {formatEuro(saved)} sur {formatEuro(total)}.
          </p>
          <Button onClick={() => update((s) => stopProject(s, projectId, month, nowIso()))}>Arrêter d’épargner</Button>
        </>
      ) : project.budget ? (
        <>
          <p className="field-hint muted">
            Épargne arrêtée{group ? ` (${group.name})` : ''} : {formatEuro(saved)} de côté sur {formatEuro(total)}.
            {reachable ? ` Reprendre : ${formatEuro(preview)} par mois.` : why ? ` ${why}` : ''}
          </p>
          {reachable && <Button onClick={() => update((s) => syncProjectBudget(s, projectId, month, nowIso()))}>Reprendre</Button>}
        </>
      ) : groupOptions.length === 0 ? (
        <p className="field-hint muted">Créez d’abord {budgetName} une catégorie à épargner.</p>
      ) : (
        <>
          <label className="ds-visually-hidden" htmlFor={`${uid}-group`}>
            Catégorie à épargner
          </label>
          <Select id={`${uid}-group`} options={groupOptions} value={groupId} onChange={(event) => onGroup(event.target.value)} />
          <p className="field-hint muted">{reachable ? target === month ? `${formatEuro(preview)} en ${monthLabel(month).toLowerCase()}.` : `${formatEuro(preview)} par mois, ${fromMonth(month)} à ${monthLabel(target).toLowerCase()}.` : why}</p>
          <Button tone="primary" disabled={!reachable || !groupId} onClick={() => update((s) => activateProject(s, projectId, groupId, month, createId(), nowIso()))}>
            Commencer à épargner
          </Button>
        </>
      )}
    </div>
  )
}
