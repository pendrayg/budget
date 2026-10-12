import { FlatSelector } from '@pendrayg/neomorphism-design-system'
import type { Scope } from '../lib/scope'
import type { State } from '../lib/types'

const COMMON = 'common'

/**
 * Le sous-menu du budget et des dépenses : le COMMUN, ou le budget et le compte de l'une des
 * personnes. Le choix vaut pour les deux écrans : un relevé s'importe dans le compte choisi, sans
 * avoir à dire à qui est chaque opération. À trois personnes et plus, les pastilles se replient
 * sur deux lignes. Seul, il ne s'affiche pas (cf. App).
 */
export default function ScopeSelector({ state, scope, onChange }: { state: State; scope: Scope; onChange: (scope: Scope) => void }) {
  const options = [{ id: COMMON, label: 'Commun' }, ...state.people.map((person) => ({ id: person.id, label: person.name || 'Sans nom' }))]
  return (
    <FlatSelector
      className="scope-selector"
      label="Budget de"
      options={options}
      multiline={options.length > 3}
      value={scope ?? COMMON}
      onChange={(id) => onChange(id === COMMON ? null : id)}
    />
  )
}
