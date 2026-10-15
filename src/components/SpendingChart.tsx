import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { designSystem } from '../ds'
import { formatEuro, formatPercent } from '../lib/format'
import { monthLabel, shortMonthLabel } from '../lib/month'
import { TOTAL_COLOR } from '../lib/palette'
import { niceCeiling } from './ChartParts'

export interface FillPoint {
  month: string
  spent: number
  budget: number
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: FillPoint }> }) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{monthLabel(point.month)}</div>
      <div className="chart-tooltip-row">
        <span className="muted">Dépensé</span>
        <span>{formatEuro(point.spent)}</span>
      </div>
      <div className="chart-tooltip-row">
        <span className="muted">Budget</span>
        <span>{formatEuro(point.budget)}</span>
      </div>
      {point.budget > 0 && (
        <div className="chart-tooltip-row">
          <span className="muted">Rempli</span>
          <span>{formatPercent(point.spent / point.budget)}</span>
        </div>
      )}
      {point.spent > point.budget + 0.005 && (
        <div className="chart-tooltip-row">
          <span className="muted">Dépassement</span>
          <span className="spend-over">{formatEuro(point.spent - point.budget)}</span>
        </div>
      )}
    </div>
  )
}

/**
 * Le remplissage du budget, mois par mois : pour chaque mois, le budget en piste claire, et le
 * dépensé qui la remplit par-dessus, jusqu'au budget ; au-delà, SEUL le dépassement passe à la
 * couleur du danger, empilé sur le reste : on voit d'un coup d'œil de combien on a dépassé.
 * Comme les autres graphiques : pas d'ordonnée, l'échelle part de zéro, les montants sont dans
 * l'infobulle ; les mois du plus ancien au plus récent.
 */
/**
 * Sous Star Wars, une barre est une marque pleine : elle rayonne de sa teinte (`#ds-chart-groove-fill`,
 * cité en attribut comme tout filtre du DS) et se remplit à la façon de `.ds-chart-part` (cf.
 * index.css, `.spend-bar`). Le néomorphique les garde à plat.
 */
const BAR_FILTER = designSystem === 'star-wars' ? 'url(#ds-chart-groove-fill)' : undefined

export default function SpendingChart({ points }: { points: FillPoint[] }) {
  // Le dépensé en deux morceaux empilés : jusqu'au budget, puis ce qui le dépasse.
  const data = points.map((p) => ({ ...p, within: Math.min(p.spent, Math.max(p.budget, 0)), excess: Math.max(0, p.spent - Math.max(p.budget, 0)) }))
  const high = niceCeiling(Math.max(...points.flatMap((p) => [p.spent, p.budget]), 0))
  // Une barre étroite quand il y a beaucoup de mois, jamais plus large qu'un pouce.
  const barSize = Math.max(10, Math.min(36, Math.floor(280 / Math.max(points.length, 1))))
  return (
    <div
      className="chart-body"
      role="img"
      aria-label={`Remplissage du budget par mois : ${points.map((p) => `${monthLabel(p.month)}, ${formatEuro(p.spent)} sur ${formatEuro(p.budget)}`).join(' ; ')}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        {/* Les deux barres d'un mois se superposent (`barGap` négatif) : la piste, puis le dépensé. */}
        <BarChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }} barGap={-barSize} barSize={barSize}>
          <XAxis
            dataKey="month"
            tickFormatter={shortMonthLabel}
            interval="preserveStartEnd"
            tick={{ fill: 'var(--color-muted)', fontSize: 12 }}
            axisLine={{ stroke: 'var(--color-border)' }}
            tickLine={false}
          />
          <YAxis hide domain={[0, high]} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--color-border)', opacity: 0.4 }} />
          <Bar dataKey="budget" fill="var(--color-border)" radius={[4, 4, 0, 0]} isAnimationActive={false} name="Budget" />
          {/* L'arrondi du haut va au morceau du dessus : le dépassement s'il y en a un. */}
          <Bar dataKey="within" stackId="depense" fill={TOTAL_COLOR} className="spend-bar spend-within" filter={BAR_FILTER} isAnimationActive={false} name="Dépensé">
            {data.map((point) => (
              <Cell key={point.month} radius={point.excess > 0.005 ? 0 : ([4, 4, 0, 0] as unknown as number)} />
            ))}
          </Bar>
          <Bar dataKey="excess" stackId="depense" fill="var(--color-danger)" className="spend-bar spend-excess" filter={BAR_FILTER} radius={[4, 4, 0, 0]} isAnimationActive={false} name="Dépassement" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
