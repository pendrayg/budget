// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { seedState } from '../lib/fixtures'
import { formatEuro } from '../lib/format'
import { importStatement, placeTransaction, spendingSummary } from '../lib/spending'
import MonthSpending from './MonthSpending'

afterEach(cleanup)

describe('récap des dépenses du mois', () => {
  it('juge une catégorie à épargner sur le versement du mois face à ce qu’il faut mettre de côté', () => {
    let state = importStatement(seedState(), [{ date: '2026-11-10', label: 'VIR MENSUALISATION FRAIS ANNUELS', amount: 100 }], 't').state
    state = placeTransaction(state, state.transactions[0].id, { saving: true }, 't')
    const { toSave, sections } = spendingSummary(state, '2026-11').savings
    const group = sections[0].group
    render(<MonthSpending state={state} month="2026-11" scope={null} update={() => {}} onPlace={() => {}} />)
    const row = screen.getByText(group.name).closest('.figure-row') as HTMLElement
    // Une seule catégorie à épargner : tout le versement est à elle.
    expect(row.querySelector('dd')?.textContent).toContain(`par rapport au budget : ${formatEuro(100)} sur ${formatEuro(toSave)}`)
  })
})
