import type { ButtonHTMLAttributes } from 'react'
import { cx, Shade, usePress } from '../ds'
import type { CategoryIcon } from '../lib/types'
import CategoryGlyph from './CategoryGlyph'

/**
 * Le bouton-icône du DS, pour une icône que le DS n'a pas : n'importe laquelle des icônes Nerd Font
 * de l'app (cf. lib/icons.ts). Le `IconButton` du DS n'accepte que les siennes ; celui-ci en reprend
 * le balisage — mêmes classes, même néon ou même relief (`Shade`), même enfoncement d'un toucher bref
 * (`usePress`) —, si bien qu'il suit le DS choisi comme l'autre. Une commande momentanée.
 */
export default function GlyphIconButton({
  icon,
  label,
  className,
  type = 'button',
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & { icon: CategoryIcon; label: string }) {
  const { pressed, handlers } = usePress(rest)
  return (
    <button type={type} aria-label={label} className={cx('ds-button', 'ds-icon', 'ds-momentary', pressed && 'ds-pressed', className)} {...rest} {...handlers}>
      <Shade />
      <CategoryGlyph icon={icon} />
    </button>
  )
}
