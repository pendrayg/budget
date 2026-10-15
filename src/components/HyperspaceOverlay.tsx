import { useEffect, useLayoutEffect } from 'react'
import { HyperspaceJump } from '../ds'
import { NEXT_PHASE, setJumpPhase, useJumpPhase } from '../lib/hyperspace'

/**
 * Le champ d'étoiles du saut en hyperespace (cf. lib/hyperspace.ts), par-dessus toute l'application
 * tant qu'un saut est en cours. Il mène la fin du saut : la croisière, puis la sortie. L'entrée,
 * elle, finit sur un rechargement.
 */
export default function HyperspaceOverlay() {
  const phase = useJumpPhase()

  // Le noir posé par index.html à l'arrivée d'un saut n'a plus lieu d'être : le saut le couvre
  // désormais lui-même, dans ce même rendu.
  useLayoutEffect(() => {
    delete document.documentElement.dataset.arriving
  }, [])

  useEffect(() => {
    const step = phase ? NEXT_PHASE[phase] : undefined
    if (!step) return
    const timer = setTimeout(() => setJumpPhase(step.next), step.after)
    return () => clearTimeout(timer)
  }, [phase])

  return phase ? <HyperspaceJump phase={phase} /> : null
}
