import { Button, IconButton } from '../ds'
import { useState } from 'react'
import type { CaptureLine } from '../lib/capture'
import { formatEuro } from '../lib/format'
import Sheet from './Sheet'

const day = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`

/**
 * Ce qu'une capture d'écran a donné, avant de l'importer : une ligne par opération — sa date, son
 * libellé, son montant (un crédit en +) —, chacune qu'on peut retirer si la lecture s'est trompée.
 * Une date devinée (au-dessus du premier jour lisible de la capture) est marquée « ≈ ».
 */
export default function CaptureSheet({ lines, pending, onImport, onClose }: { lines: CaptureLine[] | null; pending: number; onImport: (lines: CaptureLine[]) => void; onClose: () => void }) {
  return (
    <Sheet open={lines !== null} onClose={onClose} title="Importer une capture" titleId="capture-title">
      {lines && <CaptureLines key={lines.map((line) => `${line.date}${line.label}${line.amount}`).join('|')} lines={lines} pending={pending} onImport={onImport} />}
    </Sheet>
  )
}

function CaptureLines({ lines, pending, onImport }: { lines: CaptureLine[]; pending: number; onImport: (lines: CaptureLine[]) => void }) {
  const [kept, setKept] = useState(lines)
  return (
    <div className="form">
      {kept.length === 0 ? (
        <p className="muted">Aucune opération lue.</p>
      ) : (
        <ul className="tx-list">
          {kept.map((line, index) => (
            <li className="tx-row" key={`${line.date}${line.label}${line.amount}${index}`}>
              <span className="tx-date muted">
                {line.dateGuessed ? '≈ ' : ''}
                {day(line.date)}
              </span>
              <span className="tx-label">{line.label}</span>
              <span className="numeric">{line.amount < 0 ? `+${formatEuro(-line.amount)}` : formatEuro(line.amount)}</span>
              <IconButton icon="close" label={`Retirer ${line.label}`} onClick={() => setKept(kept.filter((_, i) => i !== index))} />
            </li>
          ))}
        </ul>
      )}
      {pending > 0 && (
        <p className="field-hint muted">
          {pending} paiement{pending > 1 ? 's' : ''} en cours écarté{pending > 1 ? 's' : ''}.
        </p>
      )}
      <Button tone="primary" disabled={kept.length === 0} onClick={() => onImport(kept)}>
        Importer {kept.length} opération{kept.length > 1 ? 's' : ''}
      </Button>
    </div>
  )
}
