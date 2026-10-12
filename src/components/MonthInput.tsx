import { isMonth, monthLabel } from '../lib/month'
import type { Month } from '../lib/types'

/**
 * Un mois, par le sélecteur natif d'iOS, sous un champ du DS. Le champ `type="month"` de Safari
 * ne se laisse pas habiller : largeur minimale, valeur centrée ou collée en haut selon la version.
 * On montre donc un champ du DS qui dit le mois (« octobre 2026 »), et on pose par-dessus le champ
 * natif, transparent : le toucher l'ouvre, il garde le libellé et le focus, et le champ du DS se
 * creuse quand il est engagé, comme les autres. Vide (`''`), il montre `placeholder`.
 */
export default function MonthInput({
  id,
  value,
  placeholder = 'Choisir un mois',
  onChange,
}: {
  id: string
  value: Month | ''
  placeholder?: string
  onChange: (month: Month | '') => void
}) {
  return (
    <div className="month-input">
      <span className="ds-input month-display" aria-hidden="true">
        {value ? monthLabel(value).toLowerCase() : <span className="month-placeholder">{placeholder}</span>}
      </span>
      <input
        id={id}
        className="month-native"
        type="month"
        value={value}
        onChange={(event) => {
          const next = event.target.value
          if (next === '' || isMonth(next)) onChange(next)
        }}
      />
    </div>
  )
}
