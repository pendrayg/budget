// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as neo from '@pendrayg/neomorphism-design-system'
import * as sw from '@pendrayg/star-wars-design-system'
import { DESIGN_SYSTEM_KEY } from '../lib/design-system'

/** L'adaptateur lit le choix au chargement du module : chaque test repart d'un module neuf. */
async function freshAdapter() {
  vi.resetModules()
  return import('.')
}

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.ds
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.resetModules()
})

type Adapter = Awaited<ReturnType<typeof freshAdapter>>

/** Deux écrans, et la barre de menu qui les choisit — comme App. */
function Shell({ ds }: { ds: Adapter }) {
  const { Body, MenuBar, Slides } = ds
  const [at, setAt] = useState<'a' | 'b'>('a')
  const items = [
    { id: 'a' as const, label: 'A', icon: 'bank' as const },
    { id: 'b' as const, label: 'B', icon: 'cog' as const },
  ]
  return (
    <>
      <Slides at={at === 'a' ? 0 : 1}>
        <Body>écran A</Body>
        <Body>écran B</Body>
      </Slides>
      <MenuBar label="Sections" items={items} active={at} onSelect={setAt} />
    </>
  )
}

describe('adaptateur du design system', () => {
  it('charge le néomorphique par défaut, et le dit sur <html>', async () => {
    const ds = await freshAdapter()
    expect(ds.Button).toBe(neo.Button)
    expect(ds.Slides).toBe(neo.Slides)
    expect(ds.designSystem).toBe('neomorphism')
    expect(document.documentElement.dataset.ds).toBe('neomorphism')
  })

  it('charge le Star Wars quand l’appareil s’en souvient', async () => {
    localStorage.setItem(DESIGN_SYSTEM_KEY, 'star-wars')
    const ds = await freshAdapter()
    expect(ds.Button).toBe(sw.Button)
    expect(ds.MenuBar).toBe(sw.MenuBar)
    expect(ds.Slides).toBe(sw.Slides)
    expect(ds.designSystem).toBe('star-wars')
    expect(document.documentElement.dataset.ds).toBe('star-wars')
  })

  it('donne toujours le saut du DS Star Wars, quel que soit le DS chargé', async () => {
    const ds = await freshAdapter()
    expect(ds.HyperspaceJump).toBe(sw.HyperspaceJump)
    expect(ds.JUMP_DURATIONS).toBe(sw.JUMP_DURATIONS)
  })

  it('change d’écran en glissant sous le néomorphique, sans voile', async () => {
    const ds = await freshAdapter()
    const { container, getByRole } = render(<Shell ds={ds} />)
    fireEvent.click(getByRole('button', { name: 'B' }))
    expect(container.querySelector('.ds-screen-blink')).toBeNull()
    expect(container.querySelector<HTMLElement>('.ds-slides-track')?.style.getPropertyValue('--slides-at')).toBe('1')
  })

  it('change d’écran sous un clignotement sous Star Wars, la pastille partant dès l’appui', async () => {
    localStorage.setItem(DESIGN_SYSTEM_KEY, 'star-wars')
    const ds = await freshAdapter()
    vi.useFakeTimers()
    const { container, getByRole } = render(<Shell ds={ds} />)
    const track = () => container.querySelector<HTMLElement>('.ds-slides-track')?.style.getPropertyValue('--slides-at')
    fireEvent.click(getByRole('button', { name: 'B' }))
    // La pastille est déjà sur B ; la vue, elle, attend sous le voile qui s'éteint.
    expect(getByRole('button', { name: 'B' }).getAttribute('aria-current')).toBe('page')
    expect(container.querySelector('.ds-screen-blink.is-out')).not.toBeNull()
    expect(track()).toBe('0')
    act(() => vi.advanceTimersByTime(sw.BLINK_MS))
    expect(track()).toBe('1')
    expect(container.querySelector('.ds-screen-blink.is-in')).not.toBeNull()
  })
})
