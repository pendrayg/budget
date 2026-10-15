import { Button } from '../ds'
import { colorVar, PERSON_COLORS } from '../lib/colors'
import type { PersonColor } from '../lib/types'

/** Le choix de la couleur d'une personne : une pastille par couleur, la courante enfoncée. */
export default function ColorChoice({ label, value, onChange }: { label: string; value: PersonColor; onChange: (color: PersonColor) => void }) {
  return (
    <div className="color-choice" role="radiogroup" aria-label={label}>
      {PERSON_COLORS.map((color) => (
        <Button
          key={color.id}
          role="radio"
          aria-checked={color.id === value}
          aria-label={color.label}
          title={color.label}
          className="color-swatch"
          active={color.id === value}
          onClick={() => onChange(color.id)}
        >
          <span className="color-dot" style={{ background: colorVar(color.id) }} aria-hidden="true" />
        </Button>
      ))}
    </div>
  )
}
