// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { seedState } from '../lib/fixtures'
import type { State } from '../lib/types'
import CalculatorView from './CalculatorView'

afterEach(cleanup)

/** La graine, une catégorie dont le ratio donne tout à Alice, et une autre au 40 / 60. */
function withSoloRatio(): State {
  const state = seedState()
  const [alice, bruno] = state.people.map((person) => person.id)
  return {
    ...state,
    splitKeys: [...state.splitKeys, { id: 'k-alice', kind: 'fixed', name: 'Alice seule', shares: [{ from: '2000-01', byPerson: { [alice]: 1, [bruno]: 0 } }], updatedAt: '2026-10-01T00:00:00.000Z' }],
    groups: [
      ...state.groups,
      { id: 'g-alice', name: 'Cadeaux d’Alice', splitKeyId: 'k-alice', save: false, updatedAt: '2026-10-01T00:00:00.000Z' },
      { id: 'g-partage', name: 'Vacances', splitKeyId: 'k-40-60', save: false, updatedAt: '2026-10-01T00:00:00.000Z' },
    ],
  }
}

describe('CalculatorView', () => {
  it('écarte les ratios où une seule personne a une part, et garde les autres', () => {
    const { getByRole, queryByRole } = render(<CalculatorView state={withSoloRatio()} month="2026-10" />)
    expect(getByRole('radio', { name: 'Prorata' })).toBeTruthy()
    expect(getByRole('radio', { name: /Vacances/ })).toBeTruthy()
    expect(queryByRole('radio', { name: 'Cadeaux d’Alice' })).toBeNull()
  })
})
