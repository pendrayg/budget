import { Button, DisclosureButton } from '../ds'
import { useState } from 'react'
import { formatEuro, formatPercent } from '../lib/format'
import { currentMonth, monthLabel } from '../lib/month'
import { isProjectSaving, projectSaved, projectTotal } from '../lib/projects'
import { inScope, type Scope } from '../lib/scope'
import type { Project, State } from '../lib/types'
import { useOpenLine } from '../hooks/useOpenLine'
import ProjectForm from './ProjectForm'
import ProjectGlyph from './ProjectGlyph'
import ProjectSheet from './ProjectSheet'

/**
 * Sous le nom d'un projet : sa cible, et s'il s'épargne (ou s'est épargné) dans le budget, sa
 * complétion — l'épargne réellement versée face à son total, en barre et en chiffres.
 */
function ProjectHint({ state, project }: { state: State; project: Project }) {
  const month = currentMonth()
  const total = projectTotal(project)
  const target = project.target ? `Pour ${monthLabel(project.target).toLowerCase()}` : null
  if (!project.budget) return target ?? project.items.map((item) => item.label || formatEuro(item.amount)).join(', ')
  const saved = projectSaved(state, project, month)
  const ratio = total > 0 ? Math.min(1, saved / total) : 0
  const status = isProjectSaving(state, project, month) ? null : 'épargne arrêtée'
  return (
    <span className="project-hint">
      <span className="project-progress" role="progressbar" aria-label="Épargné" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)}>
        <span style={{ width: `${ratio * 100}%` }} />
      </span>
      <span>
        {formatEuro(saved)} épargnés · {formatPercent(ratio)}
        {[target, status].filter(Boolean).map((part) => ` · ${part}`)}
      </span>
    </span>
  )
}

/** La feuille `Projets` : des achats ponctuels, en lignes, avec leur total, du périmètre choisi (le
 *  commun, ou une personne). Rien à répartir. Chaque
 *  projet est un bouton section dépliante qui porte son formulaire ; un nouveau se crée en feuille.
 *  Avec une date cible, un projet s'épargne dans le budget, et sa ligne en dit la complétion. */
export default function ProjectsView({ state, scope, update }: { state: State; scope: Scope; update: (change: (state: State) => State) => void }) {
  const [creating, setCreating] = useState({ open: false, generation: 0 })
  const lines = useOpenLine()
  // Seul, tout est à soi : pas de « de … » dans les titres.
  const owner = state.people.length > 1 ? state.people.find((person) => person.id === scope) : undefined
  const projects = state.projects.filter((project) => inScope(project, scope)).sort((x, y) => x.name.localeCompare(y.name, 'fr'))

  return (
    <>
      <section className="section">
        <div className="section-head">
          <div>
            <h2>{owner ? `Projets de ${owner.name}` : 'Projets'}</h2>
            <p>{projects.length > 0 ? `${projects.length} ${projects.length > 1 ? 'projets' : 'projet'}, ${formatEuro(projects.reduce((sum, p) => sum + projectTotal(p), 0))} en tout.` : 'Les achats ponctuels, ligne par ligne.'}</p>
          </div>
        </div>
        {projects.length === 0 ? (
          <div className="empty">
            <h2>Aucun projet</h2>
            <p>Un NAS et ses disques, trois caméras, le câblage de la maison : chaque projet a ses lignes et son total.</p>
          </div>
        ) : (
          <div className="line-buttons">
            {projects.map((project) => (
              <DisclosureButton
                key={project.id}
                className="line-button"
                open={lines.isOpen(project.id)}
                onToggle={lines.toggle(project.id)}
                title={
                  <span className="line-head">
                    <span className="line-name">
                      <ProjectGlyph icon={project.icon} className="line-icon" />
                      {project.name}
                    </span>
                    <span className="numeric">{formatEuro(projectTotal(project))}</span>
                  </span>
                }
                hint={<ProjectHint state={state} project={project} />}
              >
                <ProjectForm key={lines.formKey(project.id)} projectId={project.id} state={state} scope={scope} update={update} onDone={lines.close} />
              </DisclosureButton>
            ))}
          </div>
        )}
      </section>

      {/* Comme « Ajouter une catégorie » et « Saisir un mois » : l'ajout vient après la liste. */}
      <section className="section section-actions">
        <Button tone="primary" icon="plus" onClick={() => setCreating((c) => ({ open: true, generation: c.generation + 1 }))}>
          Nouveau projet
        </Button>
      </section>
      <ProjectSheet open={creating.open} generation={creating.generation} state={state} scope={scope} update={update} onClose={() => setCreating((c) => ({ ...c, open: false }))} />
    </>
  )
}
