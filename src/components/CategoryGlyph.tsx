import { appIconOf, glyph } from '../lib/icons'
import type { CategoryIcon } from '../lib/types'

/**
 * L'icône d'une catégorie : un glyphe de la police Nerd Font, ou, pour une icône que l'app dessine
 * (le drapeau breton, le triskel), son tracé, à la hauteur et à la couleur du texte comme un glyphe.
 * Sa largeur suit les proportions de sa boîte : un drapeau est plus large que haut.
 */
export default function CategoryGlyph({ icon, className }: { icon: CategoryIcon; className?: string }) {
  const drawn = appIconOf(icon)
  if (drawn) {
    const viewBox = drawn.viewBox ?? '0 0 24 24'
    const [, , width, height] = viewBox.split(' ').map(Number)
    return (
      <svg className={['app-glyph', className].filter(Boolean).join(' ')} viewBox={viewBox} style={{ width: `${width / height}em` }} aria-hidden="true">
        {drawn.stroke ? (
          <path d={drawn.path} fill="none" stroke="currentColor" strokeWidth={drawn.stroke} strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d={drawn.path} />
        )}
      </svg>
    )
  }
  return (
    <i className={['nf', className].filter(Boolean).join(' ')} aria-hidden="true">
      {glyph(icon)}
    </i>
  )
}
