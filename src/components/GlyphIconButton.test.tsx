// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import GlyphIconButton from './GlyphIconButton'

afterEach(cleanup)

describe('GlyphIconButton', () => {
  it('reprend le bouton-icône du DS avec une icône Nerd Font de l’app', () => {
    const onClick = vi.fn()
    const { getByRole } = render(<GlyphIconButton icon={{ name: 'fa-folder_plus', code: 'eec7' }} label="Ranger CB MARCHE" onClick={onClick} />)
    const button = getByRole('button', { name: 'Ranger CB MARCHE' })
    expect(button.className).toContain('ds-button ds-icon ds-momentary')
    expect(button.getAttribute('type')).toBe('button')
    expect(button.querySelector('.ds-shade')).not.toBeNull()
    expect(button.querySelector('.nf')?.textContent).toBe(String.fromCodePoint(0xeec7))
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
