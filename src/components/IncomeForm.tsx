import { Button, DeleteButton, FlatSelector, Input } from '../ds'
import { useId, useState } from 'react'
import { createId, formatEuro, nowIso } from '../lib/format'
import { incomeOf } from '../lib/prorata'
import type { Income, Month, State } from '../lib/types'
import MonthField from './MonthField'
import NumberField from './NumberField'

interface Line {
  id: string
  label: string
  amount: number | null
}

type Draft = Record<string, Line[]>

function linesOf(state: State, month: Month, personId: string): Line[] {
  const income = incomeOf(state, month, personId)
  const lines = (income?.components ?? []).map((component) => ({ id: createId(), label: component.label ?? '', amount: component.amount }))
  return lines.length > 0 ? lines : [{ id: createId(), label: '', amount: null }]
}

function draftFor(state: State, month: Month): Draft {
  return Object.fromEntries(state.people.map((person) => [person.id, linesOf(state, month, person.id)]))
}

function total(lines: Line[]): number {
  return lines.reduce((sum, line) => sum + (line.amount ?? 0), 0)
}

/**
 * Les revenus d'un mois, personne par personne, en composantes — comme la formule du
 * classeur, `2050 + 45`, mais chaque terme nommé si on veut. Une personne à
 * l'écran à la fois : plusieurs colonnes ne tiennent pas sur un téléphone.
 *
 * Le même formulaire sert dans la ligne d'un mois (bouton section dépliante), où le mois est
 * celui de la ligne, et dans la feuille de saisie, où il se choisit (`chooseMonth`). Son brouillon
 * part des revenus connus à son montage : l'app le remonte à chaque ouverture. Chaque changement
 * s'enregistre aussitôt : pas de bouton Enregistrer.
 */
export default function IncomeForm({
  month: initialMonth,
  chooseMonth = false,
  person,
  state,
  update,
}: {
  month: Month
  chooseMonth?: boolean
  /** La personne dont on saisit les revenus, choisie ailleurs (le sous-menu du bas) : pas de sélecteur. */
  person?: string
  state: State
  update: (change: (state: State) => State) => void
}) {
  const uid = useId()
  const [month, setMonth] = useState(initialMonth)
  const [chosen, setPersonId] = useState(state.people[0].id)
  const personId = person ?? chosen
  const [draft, setDraft] = useState<Draft>(() => draftFor(state, initialMonth))

  // Changer de mois recharge ce qui est connu pour ce mois.
  const changeMonth = (next: Month) => {
    setMonth(next)
    setDraft(draftFor(state, next))
  }

  /** Écrit le revenu du mois d'une personne : ses lignes avec un montant. Les autres n'y sont pour rien. */
  const write = (forMonth: Month, forPerson: string, next: Line[]) => {
    const now = nowIso()
    update((current) => {
      const others = current.incomes.filter((income) => income.month !== forMonth || income.personId !== forPerson)
      const entered: Income = {
        month: forMonth,
        personId: forPerson,
        components: next
          .filter((line) => line.amount !== null)
          .map((line) => ({ amount: line.amount ?? 0, ...(line.label.trim() ? { label: line.label.trim() } : {}) })),
        updatedAt: now,
      }
      return { ...current, incomes: entered.components.length > 0 ? [...others, entered] : others }
    })
  }

  // Pas de bouton Enregistrer : chaque changement des lignes s'écrit aussitôt.
  const lines = draft[personId] ?? []
  const setLines = (next: Line[]) => {
    const nextDraft = { ...draft, [personId]: next }
    setDraft(nextDraft)
    write(month, personId, next)
  }
  const personOptions = state.people.map((person) => ({ id: person.id, label: person.name }))

  return (
    <form
      className="form"
      onSubmit={(event) => event.preventDefault()}
    >
      {chooseMonth && <MonthField id={`${uid}-month`} label="Mois" value={month} onChange={changeMonth} />}
      {!person && state.people.length > 1 && <FlatSelector label="Personne" options={personOptions} value={personId} onChange={setPersonId} />}

      <ul className="items">
        {lines.map((line, index) => (
          <li className="item-row" key={line.id}>
            <Input
              aria-label={`Libellé de la ligne ${index + 1}`}
              placeholder={index === 0 ? 'Salaire' : 'Libellé'}
              value={line.label}
              onChange={(event) => setLines(lines.map((l) => (l.id === line.id ? { ...l, label: event.target.value } : l)))}
            />
            <NumberField
              id={`${uid}-${line.id}`}
              value={line.amount}
              placeholder="0,00"
              autoFocus={chooseMonth && index === 0 && line.amount === null}
              onChange={(amount) => setLines(lines.map((l) => (l.id === line.id ? { ...l, amount } : l)))}
            />
            <DeleteButton label={`Retirer la ligne ${index + 1}`} disabled={lines.length === 1} onDelete={() => setLines(lines.filter((l) => l.id !== line.id))} />
          </li>
        ))}
        <li className="items-foot">
          <Button size="sm" icon="plus" onClick={() => setLines([...lines, { id: createId(), label: '', amount: null }])}>
            Une ligne
          </Button>
          <span className="numeric">
            Total <strong>{formatEuro(total(lines))}</strong>
          </span>
        </li>
      </ul>
    </form>
  )
}
