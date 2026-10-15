/**
 * L'adaptateur du design system. Budget s'habille au choix du néomorphique ou du Star Wars : deux
 * paquets aux mêmes composants, mêmes classes `.ds-*` et mêmes jetons `:root` — donc UN SEUL à la
 * fois, feuille de style comprise. Le choix (cf. lib/design-system.ts) est lu ici, une fois, au
 * chargement du module : le paquet élu est importé, avec sa feuille, et ses composants re-exportés.
 * L'application n'importe que d'ici, jamais d'un paquet ; en changer recharge la page.
 *
 * Les transitions viennent avec : chaque paquet a son `Slides`, qui change d'écran à sa façon — la
 * vue GLISSE sous le néomorphique ; sous Star Wars, rien ne glisse, le cadre CLIGNOTE sous le voile
 * du DS (`.ds-screen-blink`). La pastille du menu part dès l'appui, dans l'un comme dans l'autre.
 */
import { readDesignSystem, type DesignSystemId } from '../lib/design-system'

type Neo = typeof import('@pendrayg/neomorphism-design-system')

/**
 * Ce que Budget utilise, à la signature la plus étroite des deux paquets : celle du néomorphique,
 * dont Star Wars ne fait qu'élargir les icônes (`AnyIconName`). Un paquet aux props plus larges
 * s'y assigne sans peine.
 */
export type DesignSystem = Pick<
  Neo,
  | 'Body'
  | 'Button'
  | 'ChartFilters'
  | 'DeleteButton'
  | 'Disclosure'
  | 'DisclosureButton'
  | 'FlatSelector'
  | 'Footer'
  | 'IconButton'
  | 'Input'
  | 'MenuBar'
  | 'Notice'
  | 'Screen'
  | 'SearchField'
  | 'Select'
  | 'Selectable'
  | 'SelectToggle'
  | 'Shade'
  | 'Slides'
  | 'Spinner'
  | 'cx'
  | 'usePress'
>

export type { FlatSelectorOption, MenuItem } from '@pendrayg/neomorphism-design-system'

/**
 * Le SAUT EN HYPERESPACE, qui couvre le changement de design system (cf. lib/hyperspace.ts). Il
 * appartient au DS Star Wars, mais se joue dans les deux sens — vers le néomorphique aussi : il
 * vient donc toujours de ce paquet, quel que soit le DS chargé, et sa boîte est reprise dans
 * index.css (la feuille du DS Star Wars n'est pas là sous le néomorphique).
 */
export { HyperspaceJump, JUMP_DURATIONS, type JumpPhase } from '@pendrayg/star-wars-design-system'

const id = readDesignSystem()
/** Le DS chargé, pour le peu qui ne s'écrit pas en CSS (un filtre SVG se cite en attribut). */
export const designSystem: DesignSystemId = id
// Le DS courant, lisible par le CSS de l'application (`:root[data-ds='star-wars']`).
if (typeof document !== 'undefined') document.documentElement.dataset.ds = id

const ds: DesignSystem = id === 'star-wars' ? await import('./star-wars') : await import('./neomorphism')

export const Body = ds.Body
export const Button = ds.Button
export const ChartFilters = ds.ChartFilters
export const DeleteButton = ds.DeleteButton
export const Disclosure = ds.Disclosure
export const DisclosureButton = ds.DisclosureButton
export const FlatSelector = ds.FlatSelector
export const Footer = ds.Footer
export const IconButton = ds.IconButton
export const Input = ds.Input
export const MenuBar = ds.MenuBar
export const Notice = ds.Notice
export const Screen = ds.Screen
export const SearchField = ds.SearchField
export const Select = ds.Select
export const Selectable = ds.Selectable
export const SelectToggle = ds.SelectToggle
export const Shade = ds.Shade
export const Slides = ds.Slides
export const Spinner = ds.Spinner
export const cx = ds.cx
export const usePress = ds.usePress
