/**
 * Le design system qui habille l'application : le néomorphique (défaut) ou le Star Wars. Réglage
 * d'appareil, retenu sur ce téléphone comme le budget choisi dans le sous-menu — il n'entre ni
 * dans l'état partagé ni dans la sauvegarde. Il est lu une fois, au démarrage, par l'adaptateur
 * `src/ds` ; en changer recharge la page (cf. lib/hyperspace.ts).
 */

export type DesignSystemId = 'neomorphism' | 'star-wars'

export const DESIGN_SYSTEMS: readonly DesignSystemId[] = ['neomorphism', 'star-wars']

export const DEFAULT_DESIGN_SYSTEM: DesignSystemId = 'neomorphism'

export const DESIGN_SYSTEM_LABELS: Record<DesignSystemId, string> = {
  neomorphism: 'Néomorphisme',
  'star-wars': 'Star Wars',
}

export const DESIGN_SYSTEM_KEY = 'budget:design-system'

export function isDesignSystemId(value: unknown): value is DesignSystemId {
  return typeof value === 'string' && (DESIGN_SYSTEMS as readonly string[]).includes(value)
}

/** Le DS retenu ; le défaut sans stockage, ou devant une valeur inconnue (un DS retiré, un stockage bricolé). */
export function readDesignSystem(): DesignSystemId {
  try {
    const stored = localStorage.getItem(DESIGN_SYSTEM_KEY)
    return isDesignSystemId(stored) ? stored : DEFAULT_DESIGN_SYSTEM
  } catch {
    return DEFAULT_DESIGN_SYSTEM
  }
}

export function writeDesignSystem(id: DesignSystemId): void {
  if (!isDesignSystemId(id)) return
  try {
    localStorage.setItem(DESIGN_SYSTEM_KEY, id)
  } catch {
    // Pas de stockage : la page rechargée reprendra le défaut.
  }
}
