import { Button, SearchField } from '../ds'
import { useEffect, useState } from 'react'
import { APP_ICON_LIST, iconLabel, searchIcons, type NerdIcon } from '../lib/icons'
import type { CategoryIcon } from '../lib/types'
import CategoryGlyph from './CategoryGlyph'
import Sheet from './Sheet'

// La liste complète des icônes Nerd Font (plus de dix mille) n'est chargée qu'à la première
// ouverture du sélecteur, dans un fichier à part : l'app n'en paie le poids que si on s'en sert.
// Les icônes que l'app dessine passent devant.
let chargement: Promise<NerdIcon[]> | null = null
let chargees: NerdIcon[] | null = null
function chargerIcones(): Promise<NerdIcon[]> {
  chargement ??= import('../lib/nerd-icons.json').then((module) => (chargees = [...APP_ICON_LIST, ...(module.default as NerdIcon[])]))
  return chargement
}

/**
 * Le choix d'une icône parmi toutes celles de Nerd Fonts : une recherche (en anglais, ou en
 * français pour les mots du budget), et une grille de résultats. Sans recherche, une sélection
 * d'icônes de ménage. Il n'est monté que le temps du choix : il s'ouvre à son montage.
 */
export default function IconPicker({
  value,
  onPick,
  onClose,
}: {
  value: CategoryIcon | undefined
  onPick: (icon: CategoryIcon) => void
  onClose: () => void
}) {
  const [icons, setIcons] = useState<NerdIcon[] | null>(chargees)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (icons) return
    let actif = true
    void chargerIcones().then((list) => {
      if (actif) setIcons(list)
    })
    return () => {
      actif = false
    }
  }, [icons])

  const results = icons ? searchIcons(icons, query) : []

  return (
    <Sheet open onClose={onClose} title="Icône" titleId="icon-picker-title">
      <div className="form">
        <SearchField aria-label="Chercher une icône" placeholder="maison, voiture, wifi…" value={query} onChange={setQuery} onClear={() => setQuery('')} />
        {!icons ? (
          <p className="muted">Chargement des icônes…</p>
        ) : results.length === 0 ? (
          <p className="muted">Aucune icône pour « {query} ».</p>
        ) : (
          <ul className="icon-grid">
            {results.map(([name, code]) => (
              <li key={name}>
                <Button
                  className="icon-choice"
                  aria-label={iconLabel(name)}
                  title={iconLabel(name)}
                  active={value?.name === name}
                  onClick={() => {
                    onPick({ name, code })
                    onClose()
                  }}
                >
                  <CategoryGlyph icon={{ name, code }} />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  )
}
