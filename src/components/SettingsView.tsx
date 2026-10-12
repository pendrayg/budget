import { Button, DeleteButton, DisclosureButton, Input, Notice } from '@pendrayg/neomorphism-design-system'
import { useRef, useState } from 'react'
import { colorOf } from '../lib/colors'
import { nowIso } from '../lib/format'
import { addPerson, isSolo, MAX_PEOPLE, peopleNames, removePerson } from '../lib/people'
import { defaultState, exportPayload, parseImport } from '../lib/state'
import type { PersonColor, State } from '../lib/types'
import type { SyncStatus } from '../hooks/useSharedState'
import ColorChoice from './ColorChoice'
import NumberField from './NumberField'

function download(state: State) {
  const blob = new Blob([exportPayload(state)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `budget-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}

export default function SettingsView({
  state,
  update,
  replace,
  status,
  dirty,
  version,
  onSync,
}: {
  state: State
  update: (change: (state: State) => State) => void
  replace: (state: State) => void
  status: SyncStatus
  dirty: boolean
  version: number
  onSync: () => void
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null)

  const statusText: Record<SyncStatus, string> = {
    idle: dirty ? 'Des modifications attendent d’être envoyées.' : `À jour avec le serveur (version ${version}).`,
    loading: 'Lecture du serveur…',
    saving: 'Envoi en cours…',
    offline: 'Serveur injoignable : les modifications restent sur ce téléphone et partiront plus tard.',
    error: 'Le serveur a répondu une erreur.',
  }

  const rename = (personId: string, name: string) =>
    update((s) => ({ ...s, people: s.people.map((p) => (p.id === personId ? { ...p, name, updatedAt: nowIso() } : p)) }))
  const recolor = (personId: string, color: PersonColor) =>
    update((s) => ({ ...s, people: s.people.map((p) => (p.id === personId ? { ...p, color, updatedAt: nowIso() } : p)) }))
  // Où vont les données d'une personne qu'on retire : à celle qui reste, ou au commun.
  const removalLabel = (person: { id: string; name: string }) => {
    const others = state.people.filter((p) => p.id !== person.id)
    const to = others.length === 1 ? `à ${others[0].name}` : 'au commun'
    return `Confirmer : retirer ${person.name}, ses catégories et opérations vont ${to}, ses revenus sont supprimés`
  }

  async function importFile(file: File) {
    try {
      const imported = parseImport(await file.text())
      replace(imported)
      setMessage({ tone: 'ok', text: `Sauvegarde restaurée : ${imported.categories.length} catégories, ${imported.incomes.length} revenus.` })
    } catch (error) {
      setMessage({ tone: 'warn', text: error instanceof Error ? error.message : 'Fichier illisible.' })
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <section className="section">
      <div className="section-head">
        <div>
          <h2>Réglages</h2>
          <p>Les personnes, le prorata et les données. La répartition se règle dans chaque catégorie du budget.</p>
        </div>
      </div>

      <div className="reglages-groupes">
        <DisclosureButton title="Personnes" hint={peopleNames(state.people)} icon="account">
          {/* Chaque personne : son nom, sa couleur dans les graphiques, et de quoi la retirer. De
              une à quatre ; seule, une personne n'a pas de commun. */}
          <div className="form">
            {state.people.map((person, index) => (
              <div className="field" key={person.id}>
                <div className="person-head">
                  <label htmlFor={`person-${person.id}`}>{index === 0 ? 'Première personne' : index === 1 ? 'Seconde personne' : `${index + 1}ᵉ personne`}</label>
                  {!isSolo(state) && <DeleteButton label={`Retirer ${person.name}`} confirmLabel={removalLabel(person)} onDelete={() => update((s) => removePerson(s, person.id, nowIso()))} />}
                </div>
                <Input id={`person-${person.id}`} value={person.name} onChange={(event) => rename(person.id, event.target.value)} />
                <ColorChoice label={`Couleur de ${person.name}`} value={colorOf(state.people, index)} onChange={(color) => recolor(person.id, color)} />
              </div>
            ))}
            {state.people.length < MAX_PEOPLE ? (
              <div className="toolbar-end">
                <Button size="sm" icon="plus" onClick={() => update((s) => addPerson(s, `Personne ${s.people.length + 1}`, nowIso()))}>
                  Ajouter une personne
                </Button>
              </div>
            ) : (
              <p className="field-hint muted">Quatre personnes au plus.</p>
            )}
            <p className="field-hint muted">
              {isSolo(state)
                ? 'Seul, pas de commun : le budget est le vôtre. Ajoutez quelqu’un pour partager.'
                : 'Chacun a son budget et son compte à lui ; le commun se répartit entre tous. Retirer quelqu’un rapatrie ses catégories et ses opérations.'}
            </p>
          </div>
        </DisclosureButton>

        <DisclosureButton title="Prorata" hint={state.settings.prorataWindowMonths === 12 ? 'Sur un an glissant' : `Sur ${state.settings.prorataWindowMonths} mois glissants`} icon="calendar">
          <div className="form">
            <NumberField
              id="window"
              suffix="mois"
              label="Durée de la période glissante"
              value={state.settings.prorataWindowMonths}
              onChange={(value) => {
                if (value !== null && value >= 1) update((s) => ({ ...s, settings: { ...s.settings, prorataWindowMonths: Math.min(60, Math.round(value)) } }))
              }}
            />
            <p className="field-hint muted">Un an glissant par défaut : le budget d’un mois se répartit selon les revenus des douze mois qui le précèdent — l’argent reçu paie l’argent dépensé. Seuls les mois où tous les revenus sont saisis entrent dans la moyenne.</p>
          </div>
        </DisclosureButton>

        <DisclosureButton title="Données" hint="Synchronisation et sauvegarde" icon="cloud">
          <div className="form">
            <p className="storage-state">{statusText[status]}</p>
            <div className="toolbar-end">
              <Button size="sm" icon="refresh" onClick={onSync}>
                Synchroniser
              </Button>
            </div>

            {message && (
              <Notice tone={message.tone} title={message.text} />
            )}

            <div className="toolbar-end">
              <Button size="sm" icon="tray_arrow_down" onClick={() => download(state)}>
                Télécharger
              </Button>
              <Button size="sm" icon="tray_arrow_up" onClick={() => fileInput.current?.click()}>
                Restaurer
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void importFile(file)
                }}
              />
            </div>

            <div className="toolbar-end">
              <DeleteButton
                label="Tout effacer"
                withLabel
                size="sm"
                confirmLabel="Confirmer : effacer revenus, budget et projets"
                onDelete={() => replace(defaultState())}
              />
            </div>
          </div>
        </DisclosureButton>
      </div>
    </section>
  )
}
