import { useState } from 'react'
import { FlatSelector, type FlatSelectorOption } from '../ds'
import { DESIGN_SYSTEMS, DESIGN_SYSTEM_LABELS, readDesignSystem, type DesignSystemId } from '../lib/design-system'
import { jumpToDesignSystem } from '../lib/hyperspace'

const OPTIONS: FlatSelectorOption<DesignSystemId>[] = DESIGN_SYSTEMS.map((id) => ({ id, label: DESIGN_SYSTEM_LABELS[id] }))

/**
 * L'apparence : le design system qui habille l'application, au sélecteur plat du DS. Les deux
 * feuilles de style ne peuvent pas cohabiter (mêmes jetons, mêmes classes) : passer à l'autre est
 * un SAUT EN HYPERESPACE, au milieu duquel la page se recharge sur le nouveau DS (cf.
 * lib/hyperspace.ts). La pastille part dès l'appui, le saut avec elle.
 */
export default function AppearanceChoice() {
  const [chosen, setChosen] = useState<DesignSystemId>(readDesignSystem)
  const choose = (id: DesignSystemId) => {
    setChosen(id)
    jumpToDesignSystem(id)
  }
  return <FlatSelector label="Design system" options={OPTIONS} value={chosen} onChange={choose} />
}
