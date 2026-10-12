import { useState } from 'react'

/**
 * Les lignes d'une liste en boutons sections dépliantes : UNE ligne ouverte à la fois. En ouvrir
 * une replie la précédente ; `close` replie celle qui l'est (après un enregistrement).
 *
 * `formKey` est la clé du formulaire d'une ligne : elle change à chaque ouverture, si bien que le
 * formulaire est remonté et repart des données — un brouillon abandonné ne survit pas au repli.
 */
export function useOpenLine() {
  const [openId, setOpenId] = useState<string | null>(null)
  const [generation, setGeneration] = useState(0)

  return {
    isOpen: (id: string) => openId === id,
    toggle: (id: string) => (open: boolean) => {
      if (open) setGeneration((g) => g + 1)
      setOpenId(open ? id : null)
    },
    close: () => setOpenId(null),
    formKey: (id: string) => (openId === id ? `ouverte-${generation}` : 'repliee'),
  }
}
