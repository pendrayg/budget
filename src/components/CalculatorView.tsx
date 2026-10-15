import { FlatSelector } from '../ds'
import { useState } from 'react'
import { formatEuro, formatPercent } from '../lib/format'
import { sharesAt, split } from '../lib/prorata'
import { sortedGroups } from '../lib/summary'
import type { Month, State } from '../lib/types'
import NumberField from './NumberField'
import PeopleSummary from './PeopleSummary'

/**
 * La feuille `Calculatrice` : une somme, une clé, la part de chacun. Les deux calculatrices du
 * classeur (prorata, quote-part fixe) n'en font qu'une, la clé se choisissant.
 */
export default function CalculatorView({ state, month }: { state: State; month: Month }) {
  const [amount, setAmount] = useState<number | null>(null)
  const [keyId, setKeyId] = useState('prorata')

  // Le prorata, puis le ratio de chaque catégorie qui en a un, à son nom.
  const ratios = state.splitKeys.filter((key) => key.kind === 'fixed' && state.groups.some((group) => group.splitKeyId === key.id))
  const options = [
    { id: 'prorata', label: 'Prorata' },
    ...ratios
      .map((key) => ({ id: key.id, label: sortedGroups(state).filter((group) => group.splitKeyId === key.id).map((group) => group.name).join(', ') }))
      .sort((x, y) => x.label.localeCompare(y.label, 'fr', { sensitivity: 'base' })),
  ]
  // Une clé disparue entre-temps (sa catégorie supprimée) : retour au prorata.
  const selected = options.some((option) => option.id === keyId) ? keyId : 'prorata'
  const shares = sharesAt(state, selected, month)
  const parts = split(amount ?? 0, shares)

  return (
    // Le résultat en haut, les commandes en bas, à portée de pouce : la clé, puis la somme, au plus
    // près du clavier quand il s'ouvre.
    <section className="section calc-view">
      <div className="section-head">
        <div>
          <h2>Calculatrice</h2>
          <p>La part de chacun dans une somme, selon la clé choisie.</p>
        </div>
      </div>

      <div className="calc-result" aria-live="polite">
        <PeopleSummary people={state.people} label="Part de chacun" amount={(person) => formatEuro(parts[person.id] ?? 0)} detail={(person) => formatPercent(shares[person.id] ?? 0)} />
      </div>

      <div className="form calc-inputs">
        <FlatSelector label="Clé de répartition" options={options} value={selected} onChange={setKeyId} />
        <NumberField id="calc-amount" label="Somme" value={amount} placeholder="0,00" suffix="€" onChange={setAmount} />
      </div>
    </section>
  )
}
