import type { ReactNode } from 'react'
import type { Person } from '../lib/types'

/**
 * La part de chacun, en carte : à une ou deux personnes, de part et d'autre (le prénom au-dessus
 * du chiffre, le détail dessous) ; à trois et plus, une ligne par personne — quatre colonnes de
 * gros chiffres ne tiennent pas sur un téléphone.
 */
export default function PeopleSummary({
  people,
  label,
  amount,
  detail,
}: {
  people: readonly Person[]
  label: string
  amount: (person: Person) => ReactNode
  detail?: (person: Person) => ReactNode
}) {
  if (people.length <= 2) {
    return (
      <div className="summary-card summary-split" aria-label={label}>
        {people.map((person) => (
          <div className="summary-person" key={person.id}>
            <span className="summary-name">{person.name}</span>
            <span className="summary-amount">{amount(person)}</span>
            {detail && <span className="summary-share muted">{detail(person)}</span>}
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="summary-card summary-rows" aria-label={label}>
      {people.map((person) => (
        <div className="summary-row" key={person.id}>
          <span className="summary-name">{person.name}</span>
          {detail && <span className="summary-share muted">{detail(person)}</span>}
          <span className="summary-amount">{amount(person)}</span>
        </div>
      ))}
    </div>
  )
}
