import { IconButton } from '../ds'
import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Feuille modale : plein écran sur téléphone, panneau centré sur grand écran. Le design system
 * n'a pas de feuille : elle reste propre à l'application, et seul son bouton de fermeture est un
 * composant du DS (le bouton-icône).
 *
 * Bâtie sur `<dialog>` natif plutôt que sur une `<div>` en position fixe : l'élément
 * apporte gratuitement la fermeture par Échap, le fond cliquable, le piégeage du focus
 * et le retrait du reste de la page à l'arbre d'accessibilité — quatre comportements
 * qu'une réimplémentation manquerait au moins en partie.
 */
export default function Sheet({
  open,
  onClose,
  title,
  titleId,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  titleId: string
  children: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const body = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    // `showModal` est la seule façon d'obtenir le fond et le piégeage du focus ; l'appeler
    // sur un dialogue déjà ouvert lèverait une erreur.
    if (open && !element.open) {
      element.showModal()
      // La feuille reste montée entre deux ouvertures : sans cela elle rouvrirait là où
      // on l'avait laissée, sur un champ au milieu de nulle part.
      if (body.current) body.current.scrollTop = 0
      // `showModal` donne le focus au premier bouton, la fermeture : un champ marqué
      // `data-autofocus` le prend à sa place. Appelé dans la foulée de l'appui qui ouvre, le
      // focus fait aussi monter le clavier de l'iPhone.
      element.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    }
    if (!open && element.open) element.close()
  }, [open])

  return (
    <dialog
      ref={dialog}
      className="sheet"
      aria-labelledby={titleId}
      // Échap et le bouton de fermeture passent tous deux par là : l'état parent suit. Seulement
      // pour SA fermeture : React fait remonter celle d'une feuille ouverte par-dessus (le choix
      // d'une icône dans la création d'une catégorie), qui fermait les deux.
      onClose={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      onClick={(event) => {
        // Un clic sur le fond atteint le dialogue lui-même, jamais son contenu.
        if (event.target === dialog.current) onClose()
      }}
    >
      <div className="sheet-head">
        <h2 id={titleId}>{title}</h2>
        <IconButton icon="close" label={`Fermer : ${title.toLowerCase()}`} onClick={onClose} />
      </div>
      <div className="sheet-body" ref={body}>
        {children}
      </div>
    </dialog>
  )
}
