// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { seedState } from '../lib/fixtures'
import { importStatement, placeTransaction } from '../lib/spending'
import MonthSpending from './MonthSpending'

afterEach(cleanup)

describe('récap des dépenses du mois', () => {
  it('donne l’écart de chaque dépense qui a eu une opération, pas de chaque catégorie', () => {
    let state = importStatement(seedState(), [{ date: '2026-11-04', label: 'CARTE SUPERMARCHE', amount: 41 }], 't').state
    const courses = state.categories.find((c) => c.name === 'Courses')!
    state = placeTransaction(state, state.transactions[0].id, { categoryId: courses.id }, 't')
    const { container } = render(<MonthSpending state={state} month="2026-11" scope={null} update={() => {}} onPlace={() => {}} />)
    const names = [...container.querySelectorAll('.spend-recap dt')].map((dt) => dt.textContent)
    expect(names).toEqual(['Total', 'Courses'])
  })
})
