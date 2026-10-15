/**
 * Le SAUT EN HYPERESPACE qui couvre un changement de design system.
 *
 * Changer de DS recharge la page (cf. src/ds) : les deux feuilles ne cohabitent pas. Le saut est
 * donc coupé en deux, de part et d'autre du rechargement, au seul instant où l'écran est
 * entièrement couvert — l'entrée en croisière :
 *
 *   page quittée   `enter` (accélération), puis en croisière : choix écrit, marque d'arrivée, rechargement
 *   page d'arrivée reprend en `cruise`, puis `exit` (décélération, le noir s'efface sur le nouveau DS)
 *
 * La marque d'arrivée vit dans `sessionStorage` (cet onglet seulement) et ne sert qu'une fois.
 * `index.html` la lit aussi, avant tout chargement, pour peindre la page en noir : le rechargement
 * ne laisse pas entrevoir la page entre les deux moitiés du saut. Sous `prefers-reduced-motion`,
 * pas de saut : le choix est écrit et la page rechargée aussitôt.
 */
import { useSyncExternalStore } from 'react'
import { JUMP_DURATIONS, type JumpPhase } from '../ds'
import { readDesignSystem, writeDesignSystem, type DesignSystemId } from './design-system'
import { reloadPage } from './page'

export const ARRIVAL_KEY = 'budget:hyperspace'

/** Vrai si la page naît d'un saut — et efface la marque : un rechargement manuel ne le rejoue pas. */
function takeArrival(): boolean {
  try {
    if (typeof sessionStorage === 'undefined' || sessionStorage.getItem(ARRIVAL_KEY) === null) return false
    sessionStorage.removeItem(ARRIVAL_KEY)
    return true
  } catch {
    return false
  }
}

function markArrival(id: DesignSystemId): void {
  try {
    sessionStorage.setItem(ARRIVAL_KEY, id)
  } catch {
    // Stockage refusé : la page d'arrivée s'ouvrira sans la fin du saut, sur le bon DS quand même.
  }
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false
}

/** La phase du saut en cours, `null` hors saut. Une page née d'un saut s'ouvre en croisière. */
let phase: JumpPhase | null = takeArrival() ? 'cruise' : null
const listeners = new Set<() => void>()

export function jumpPhase(): JumpPhase | null {
  return phase
}

export function setJumpPhase(next: JumpPhase | null): void {
  if (next === phase) return
  phase = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** La phase du saut, pour un composant : il se rend à nouveau à chaque phase. */
export function useJumpPhase(): JumpPhase | null {
  return useSyncExternalStore(subscribe, jumpPhase, jumpPhase)
}

/** Passe à un autre design system, en sautant. Sans effet vers le DS courant ou pendant un saut. */
export function jumpToDesignSystem(id: DesignSystemId): void {
  if (id === readDesignSystem() || phase !== null) return
  if (prefersReducedMotion()) {
    writeDesignSystem(id)
    reloadPage()
    return
  }
  setJumpPhase('enter')
  setTimeout(() => {
    // Écran couvert : le choix s'écrit, et la page repart sur le nouveau DS, en pleine croisière.
    setJumpPhase('cruise')
    writeDesignSystem(id)
    markArrival(id)
    reloadPage()
  }, JUMP_DURATIONS.enter)
}

/** Les phases qui suivent la croisière, leur durée : la croisière, puis la sortie. */
export const NEXT_PHASE: Partial<Record<JumpPhase, { next: JumpPhase | null; after: number }>> = {
  cruise: { next: 'exit', after: JUMP_DURATIONS.cruise },
  exit: { next: null, after: JUMP_DURATIONS.exit },
}
