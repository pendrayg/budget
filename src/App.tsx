import { Body, Button, ChartFilters, Footer, MenuBar, Notice, Screen, Slides, Spinner, type MenuItem } from './ds'
import { useMemo, useState, type ReactNode } from 'react'
import BudgetView from './components/BudgetView'
import CalculatorView from './components/CalculatorView'
import HyperspaceOverlay from './components/HyperspaceOverlay'
import DepensesView from './components/DepensesView'
import IncomeSheet from './components/IncomeSheet'
import IncomesView from './components/IncomesView'
import ProjectsView from './components/ProjectsView'
import ReminderNotice from './components/ReminderNotice'
import ScopeSelector from './components/ScopeSelector'
import SettingsView from './components/SettingsView'
import { useSharedState } from './hooks/useSharedState'
import { missingIncomeMonths } from './lib/missing'
import { currentMonth } from './lib/month'
import { isSolo, scopeFor } from './lib/people'
import type { Scope } from './lib/scope'
import type { Month } from './lib/types'

type Section = 'budget' | 'revenus' | 'depenses' | 'calculatrice' | 'projets' | 'reglages'

/**
 * Les six destinations (cinq pour une personne seule : rien à répartir, pas de calculatrice). Le
 * BUDGET ouvre la marche : c'est la feuille qu'on consultait, ce que
 * chacun verse ce mois-ci. Les revenus la nourrissent, les dépenses (les relevés importés) en font
 * l'état des lieux, la calculatrice la prolonge à une somme
 * quelconque, les projets sont à part, et les réglages sont une destination comme une autre.
 * Les saisies (un revenu, une catégorie, un projet) sont des ACTIONS : elles s'ouvrent en
 * feuille, pas en destination.
 */
const SECTIONS: MenuItem<Section>[] = [
  { id: 'budget', label: 'Budget', ariaLabel: 'Budget du mois', icon: 'bank' },
  { id: 'revenus', label: 'Revenus', ariaLabel: 'Revenus et prorata', icon: 'tray_arrow_down' },
  { id: 'depenses', label: 'Dépenses', ariaLabel: 'Dépenses réelles, d’après les relevés', icon: 'tray_arrow_up' },
  { id: 'calculatrice', label: 'Calcul', ariaLabel: 'Calculatrice de répartition', icon: 'chart_donut' },
  { id: 'projets', label: 'Projets', ariaLabel: 'Projets ponctuels', icon: 'format_list_bulleted' },
  { id: 'reglages', label: 'Réglages', ariaLabel: 'Réglages', icon: 'cog' },
]

/** Pas plus d'un rechargement par minute : une règle Access mal réglée ne doit pas boucler. */
const RELOAD_GUARD_KEY = 'budget:access-reload'
const RELOAD_GUARD_MS = 60_000

/**
 * La session Cloudflare Access a expiré : recharger la page la fait repasser par la connexion.
 * Les changements non envoyés restent dans le miroir local et partiront au retour.
 */
function reloadForAccess(): void {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY))
    if (Number.isFinite(last) && Date.now() - last < RELOAD_GUARD_MS) return
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()))
  } catch {
    // Pas de stockage de session : on recharge quand même, une fois.
  }
  window.location.reload()
}

/** Le budget choisi dans le sous-menu, retenu sur ce téléphone : chacun retrouve le sien. */
const SCOPE_KEY = 'budget:scope'

function readScope(): Scope {
  try {
    return localStorage.getItem(SCOPE_KEY) || null
  } catch {
    return null
  }
}

function writeScope(scope: Scope): void {
  try {
    if (scope) localStorage.setItem(SCOPE_KEY, scope)
    else localStorage.removeItem(SCOPE_KEY)
  } catch {
    // Pas de stockage : le choix vaut pour la session.
  }
}

export default function App() {
  const shared = useSharedState(reloadForAccess)
  const [section, setSection] = useState<Section>('budget')
  const [incomeSheet, setIncomeSheet] = useState<{ open: boolean; month: Month; generation: number }>({ open: false, month: currentMonth(), generation: 0 })

  const [chosenScope, setChosenScope] = useState<Scope>(readScope)
  // Seul, c'est soi ; un choix retenu qui ne désigne plus personne retombe sur le commun.
  const solo = isSolo(shared.state)
  const scope = scopeFor(shared.state, chosenScope)
  // Seul, rien à répartir : pas de calculatrice. Une section disparue sous les pieds ramène au budget.
  const sections = solo ? SECTIONS.filter((item) => item.id !== 'calculatrice') : SECTIONS
  const current = sections.some((item) => item.id === section) ? section : 'budget'
  const chooseScope = (next: Scope) => {
    setChosenScope(next)
    writeScope(next)
  }

  const missing = useMemo(() => missingIncomeMonths(shared.state), [shared.state])
  const openIncome = (m: Month) => setIncomeSheet((s) => ({ open: true, month: m, generation: s.generation + 1 }))

  const screens: Record<Section, ReactNode> = {
    budget: <BudgetView state={shared.state} month={currentMonth()} scope={scope} update={shared.update} onEnterIncome={openIncome} />,
    revenus: <IncomesView state={shared.state} month={currentMonth()} missing={missing} update={shared.update} onEnterMonth={openIncome} />,
    depenses: <DepensesView state={shared.state} scope={scope} update={shared.update} />,
    calculatrice: <CalculatorView state={shared.state} month={currentMonth()} />,
    projets: <ProjectsView state={shared.state} scope={scope} update={shared.update} />,
    reglages: (
      <SettingsView
        state={shared.state}
        update={shared.update}
        replace={shared.replace}
        status={shared.status}
        dirty={shared.dirty}
        version={shared.version}
        onSync={shared.sync}
      />
    ),
  }

  const busy = shared.status === 'loading' || shared.status === 'saving'

  return (
    <>
      <Screen>
        {/* Les filtres de relief des graphiques (DS) : une fois pour toute l'application. */}
        <ChartFilters />
        <span className={`sync-indicator${busy ? ' is-on' : ''}`} aria-hidden="true">
          <Spinner compact />
        </span>

        <Slides at={sections.findIndex((item) => item.id === current)} role="main">
          {sections.map(({ id }) => (
            <Body key={id}>
              <div className="page">
                {/* Les rappels valent pour toute l'application : en tête de chaque écran. */}
                {shared.notice && (
                  <Notice tone="ok" title={shared.notice} className="sync-notice">
                    <Button tone="link" onClick={shared.dismissNotice}>
                      Compris
                    </Button>
                  </Notice>
                )}
                {shared.status === 'offline' && (
                  <Notice tone="warn" title="Serveur injoignable">
                    Les modifications restent sur ce téléphone et partiront dès que possible.
                  </Notice>
                )}
                <ReminderNotice months={missing} onEnter={openIncome} />
                {screens[id]}
              </div>
            </Body>
          ))}
        </Slides>

        <Footer>
          {/* Le sous-menu du budget, des dépenses et des projets, au-dessus du menu, près du pouce :
              il ne se montre que sur ces trois écrans, dont il choisit le périmètre. */}
          {!solo && (current === 'budget' || current === 'depenses' || current === 'projets') && <ScopeSelector state={shared.state} scope={scope} onChange={chooseScope} />}
          <MenuBar className="app-menu" label="Sections" items={sections} active={current} onSelect={setSection} />
        </Footer>

        <IncomeSheet open={incomeSheet.open} generation={incomeSheet.generation} month={incomeSheet.month} state={shared.state} update={shared.update} onClose={() => setIncomeSheet((s) => ({ ...s, open: false }))} />
      </Screen>
      {/* Hors de l'écran : le saut couvre toute la fenêtre (position fixe), barre de menu comprise. */}
      <HyperspaceOverlay />
    </>
  )
}
