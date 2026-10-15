import { FlatSelector } from '../ds'
import type { Scope } from '../lib/scope'
import type { State } from '../lib/types'

const COMMON = 'common'

/**
 * Le sous-menu du budget, des dépenses et des projets : le COMMUN, ou le budget, le compte et les
 * projets de l'une des personnes. Le choix vaut pour les trois écrans : un relevé s'importe dans le
 * compte choisi, un projet naît dans le périmètre choisi, sans avoir à dire à qui il est. À trois personnes et plus, les pastilles se replient
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
