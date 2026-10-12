/**
 * La hauteur de l'écran d'une web app installée sur iPhone.
 *
 * Ajoutée à l'écran d'accueil, avec une barre d'état translucide (`black-translucent`) et
 * `viewport-fit=cover`, l'app passe SOUS la barre d'état. Mais iOS calcule `100dvh` comme si
 * elle n'y passait pas : la hauteur rendue est celle de l'écran MOINS la barre d'état, et tout ce
 * qui se pose en bas de l'écran — la barre de menu — flotte une cinquantaine de points trop haut,
 * au-dessus d'une bande vide.
 *
 * En web app, il n'y a ni barre d'adresse ni barre d'outils : l'app occupe l'écran entier, et sa
 * hauteur EST celle de l'écran. Le DS prévoit `--app-height` pour le lui dire. Dans Safari, rien
 * ne change : `100dvh` y suit correctement les barres qui apparaissent et disparaissent.
 *
 * `screen` ne pivote pas sur iOS : il donne toujours les dimensions en portrait. En paysage, la
 * hauteur est donc la plus petite des deux.
 */

export interface ViewportFacts {
  standalone: boolean
  landscape: boolean
  screenWidth: number
  screenHeight: number
  /** La hauteur que le navigateur donne lui-même à la fenêtre. */
  innerHeight: number
}

/** La hauteur à imposer à l'écran de l'app, ou `null` pour laisser `100dvh` faire. */
export function appHeight(facts: ViewportFacts): number | null {
  if (!facts.standalone) return null
  const long = Math.max(facts.screenWidth, facts.screenHeight)
  const short = Math.min(facts.screenWidth, facts.screenHeight)
  if (!(long > 0) || !(short > 0)) return null
  const height = facts.landscape ? short : long
  // Jamais plus petit que ce que le navigateur donne déjà : si iOS corrige un jour son calcul,
  // ou sur un écran où la fenêtre est plus grande que prévu, on ne rogne rien.
  return Math.max(height, Math.round(facts.innerHeight))
}

function readFacts(): ViewportFacts {
  const nav = navigator as Navigator & { standalone?: boolean }
  return {
    standalone: nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches,
    landscape: window.matchMedia('(orientation: landscape)').matches,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    innerHeight: window.innerHeight,
  }
}

/** Pose `--app-height` en web app, et la suit à chaque rotation. */
export function installAppHeight(): void {
  const apply = () => {
    const height = appHeight(readFacts())
    if (height === null) document.documentElement.style.removeProperty('--app-height')
    else document.documentElement.style.setProperty('--app-height', `${height}px`)
  }
  apply()
  window.addEventListener('resize', apply)
  window.addEventListener('orientationchange', apply)
}
