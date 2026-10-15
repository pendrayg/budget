import type { ReactNode } from 'react'
import { Bar, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { designSystem } from '../ds'
import { formatEuro, formatPercent } from '../lib/format'
import { monthLabel, shortMonthLabel } from '../lib/month'
import { INCOME_COLOR, TOTAL_COLOR } from '../lib/palette'
import { monthTicks, niceCeiling } from './ChartParts'

/** Un mois du graphique. `null` : pas de relevé (dépensé, budget), ou pas de revenu complet. */
export interface FillPoint {
  month: string
  spent: number | null
  budget: number | null
  income: number | null
  /** Le revenu du mois moins ce qu'on verse au commun et son budget personnel. */
  remaining: number | null
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="chart-tooltip-row">
      <span className="muted">{label}</span>
      <span>{children}</span>
    </div>
  )
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: FillPoint }> }) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  const { spent, budget, income, remaining } = point
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{monthLabel(point.month)}</div>
      {income !== null && <Row label="Revenus">{formatEuro(income)}</Row>}
      {spent !== null && <Row label="Dépensé">{formatEuro(spent)}</Row>}
      {budget !== null && <Row label="Budget">{formatEuro(budget)}</Row>}
      {spent !== null && budget !== null && budget > 0 && <Row label="Rempli">{formatPercent(spent / budget)}</Row>}
      {spent !== null && budget !== null && spent > budget + 0.005 && (
        <Row label="Dépassement">
          <span className="spend-over">{formatEuro(spent - budget)}</span>
        </Row>
      )}
      {remaining !== null && (
        <Row label="Reste à vivre">
          <span className={remaining < 0 ? 'spend-over' : undefined}>{formatEuro(remaining)}</span>
        </Row>
      )}
    </div>
  )
}

/**
 * Sous Star Wars, une barre est une marque pleine : elle rayonne de sa teinte (`#ds-chart-groove-fill`,
 * cité en attribut comme tout filtre du DS) et se remplit à la façon de `.ds-chart-part` (cf.
 * index.css, `.spend-bar`). Le néomorphique les garde à plat.
 */
const BAR_FILTER = designSystem === 'star-wars' ? 'url(#ds-chart-groove-fill)' : undefined

/**
 * Le mois en chiffres, mois par mois : pour chaque mois, le budget en piste claire, et le dépensé
 * qui la remplit par-dessus, jusqu'au budget ; au-delà, SEUL le dépassement passe à la couleur du
 * danger, empilé sur le reste : on voit d'un coup d'œil de combien on a dépassé. Par-dessus, les
 * REVENUS en pointillé, à l'encre discrète du DS, comme au graphique du budget : ils cadrent sans
 * rivaliser. Un mois sans relevé n'a que ses revenus ; un mois sans revenu complet, que ses barres.
 * Comme les autres graphiques : pas d'ordonnée, l'échelle part de zéro, les montants — et le reste
 * à vivre — sont dans l'infobulle ; les mois du plus ancien au plus récent.
 */
export default function SpendingChart({ points }: { points: FillPoint[] }) {
  // Le dépensé en deux morceaux empilés : jusqu'au budget, puis ce qui le dépasse.
  const data = points.map((p) => {
    if (p.spent === null) return { ...p, within: null, excess: null }
    const budget = Math.max(p.budget ?? 0, 0)
    return { ...p, within: Math.min(p.spent, budget), excess: Math.max(0, p.spent - budget) }
  })
  const high = niceCeiling(Math.max(...points.flatMap((p) => [p.spent ?? 0, p.budget ?? 0, p.income ?? 0]), 0))
  // Une barre étroite quand il y a beaucoup de mois, jamais plus large qu'un pouce.
  const barSize = Math.max(10, Math.min(36, Math.floor(280 / Math.max(points.length, 1))))
  const described = points.map((p) =>
    [
      monthLabel(p.month),
      p.income !== null && `revenus ${formatEuro(p.income)}`,
      p.spent !== null && `${formatEuro(p.spent)} dépensés sur ${formatEuro(p.budget ?? 0)}`,
      p.remaining !== null && `reste à vivre ${formatEuro(p.remaining)}`,
    ]
      .filter(Boolean)
      .join(', '),
  )
  return (
    <div className="chart-body" role="img" aria-label={`Revenus et remplissage du budget par mois : ${described.join(' ; ')}`}>
      <ResponsiveContainer width="100%" height="100%">
        {/* Les deux barres d'un mois se superposent (`barGap` négatif) : la piste, puis le dépensé. */}
        <ComposedChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }} barGap={-barSize} barSize={barSize}>
          <XAxis
            dataKey="month"
            tickFormatter={shortMonthLabel}
            // Au plus quatre repères, le dernier toujours montré : douze mois ne tiennent pas côte à côte.
            ticks={monthTicks(data.length).map((i) => data[i].month)}
            interval={0}
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
              <Cell key={point.month} radius={(point.excess ?? 0) > 0.005 ? 0 : ([4, 4, 0, 0] as unknown as number)} />
            ))}
          </Bar>
          <Bar dataKey="excess" stackId="depense" fill="var(--color-danger)" className="spend-bar spend-excess" filter={BAR_FILTER} radius={[4, 4, 0, 0]} isAnimationActive={false} name="Dépassement" />
          {/* Un mois isolé, sans voisin à qui se relier, garde un point : sans lui, son revenu ne se verrait pas. */}
          <Line
            type="linear"
            dataKey="income"
            stroke={INCOME_COLOR}
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={(props: { cx?: number; cy?: number; index?: number }) => {
              const i = props.index ?? 0
              const alone = data[i]?.income !== null && (data[i - 1]?.income ?? null) === null && (data[i + 1]?.income ?? null) === null
              return alone && props.cx !== undefined && props.cy !== undefined ? (
                <circle key={i} cx={props.cx} cy={props.cy} r={3} fill={INCOME_COLOR} />
              ) : (
                <g key={i} />
              )
            }}
            activeDot={{ r: 4, fill: INCOME_COLOR, stroke: 'var(--color-bg)', strokeWidth: 2 }}
            isAnimationActive={false}
            name="Revenus"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
