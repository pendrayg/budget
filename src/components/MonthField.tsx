import type { Month } from '../lib/types'
import MonthInput from './MonthInput'

/** Un mois, par le sélecteur natif d'iOS (cf. `MonthInput`), sous son libellé. */
export default function MonthField({ id, label, value, onChange }: { id: string; label: string; value: Month; onChange: (month: Month) => void }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <MonthInput
        id={id}
        value={value}
        onChange={(month) => {
          if (month !== '') onChange(month)
        }}
      />
    </div>
  )
}
