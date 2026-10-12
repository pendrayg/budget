import type { Scope } from '../lib/scope'
import type { State } from '../lib/types'
import ProjectForm from './ProjectForm'
import Sheet from './Sheet'

/** La feuille d'un NOUVEAU projet ; un projet qui existe se modifie dans sa ligne, dépliée. */
export default function ProjectSheet({
  open,
  generation,
  state,
  scope,
  update,
  onClose,
}: {
  open: boolean
  generation: number
  state: State
  scope: Scope
  update: (change: (state: State) => State) => void
  onClose: () => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Nouveau projet" titleId="project-title">
      <ProjectForm key={generation} projectId={null} state={state} scope={scope} update={update} onDone={onClose} />
    </Sheet>
  )
}
