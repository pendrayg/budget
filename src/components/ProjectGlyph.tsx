import { PROJECT_ICON } from '../lib/projects'
import type { CategoryIcon } from '../lib/types'
import CategoryGlyph from './CategoryGlyph'

/**
 * Les icônes d'un projet, devant son nom : TOUJOURS la brique des projets, puis celle qu'on lui a
 * choisie, s'il en a une. Les mêmes devant la dépense qui l'épargne, au budget.
 */
export default function ProjectGlyph({ icon, className }: { icon?: CategoryIcon; className?: string }) {
  return (
    <>
      <CategoryGlyph icon={PROJECT_ICON} className={className} />
      {icon && <CategoryGlyph icon={icon} className={className} />}
    </>
  )
}
