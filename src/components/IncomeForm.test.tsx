// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { seedState } from '../lib/fixtures'
import { incomeOf, incomeTotal } from '../lib/prorata'
import type { State } from '../lib/types'
import IncomeForm from './IncomeForm'

afterEach(cleanup)

/** Un formulaire branché sur un état qu'il modifie pour de bon. */
function mount(person?: string) {
  let state: State = seedState()
  const update = (change: (s: State) => State) => {
    state = change(state)
  }
  const result = render(<IncomeForm month="2026-09" person={person} state={state} update={update} />)
  return { ...result, state: () => state }
}

describe('IncomeForm', () => {
  it('saisit les revenus de la personne donnée, sans sélecteur, et ne touche pas à ceux des autres', () => {
    const before = seedState()
    const [alice, bruno] = before.people.map((person) => person.id)
    const { container, state } = mount(bruno)
    expect(container.querySelector('[role="radiogroup"]')).toBeNull()
    const amount = container.querySelector<HTMLInputElement>('input[inputmode="decimal"]')!
    fireEvent.change(amount, { target: { value: '3000' } })
    expect(incomeTotal(incomeOf(state(), '2026-09', bruno))).toBeGreaterThan(incomeTotal(incomeOf(before, '2026-09', bruno)))
    expect(incomeOf(state(), '2026-09', alice)).toEqual(incomeOf(before, '2026-09', alice))
  })

  it('propose chaque personne sans personne donnée', () => {
    const { container } = mount()
    expect(container.querySelector('[role="radiogroup"]')).not.toBeNull()
  })
})
