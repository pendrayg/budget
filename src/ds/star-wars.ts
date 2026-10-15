/**
 * Le paquet Star Wars et sa feuille de style, chargés ensemble par l'adaptateur (cf. index.ts).
 * Son `Slides` ne fait rien glisser : la pastille du menu s'éteint sur l'ancienne destination dès
 * l'appui et se rallume sur la nouvelle ; la vue fait de même, aux mêmes instants, sous le voile du
 * DS (`.ds-screen-blink`), qui clignote à la taille du cadre.
 */
import './star-wars.css'

export * from '@pendrayg/star-wars-design-system'
