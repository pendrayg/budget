import type { ReactNode } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
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
 * Sous Star Wars, le dépensé est une marque pleine : il rayonne de sa teinte (`#ds-chart-groove-fill`,
 * cité en attribut comme tout filtre du DS) et se remplit à la façon de `.ds-chart-part` (cf.
 * index.css, `.spend-bar`). Le néomorphique le garde à plat.
 */
const BAR_FILTER = designSystem === 'star-wars' ? 'url(#ds-chart-groove-fill)' : undefined

/** Le trait pointillé des deux contours : les revenus, et le budget à remplir. */
const DASH = '4 3'

type ChartPoint = FillPoint & { top: number }

/**
 * LA barre d'un mois, dessinée d'un tenant. recharts la pose à la hauteur de `top` (le plus haut
 * de ses chiffres) : d'où l'échelle, en pixels par euro, de tout ce qui s'y dessine.
 *   - les REVENUS, la barre principale : un contour pointillé, à l'encre discrète du DS ;
 *   - le BUDGET, la barre à remplir : un contour pointillé à la teinte du total, rentré dans
 *     celle des revenus ;
 *   - le DÉPENSÉ, qui la remplit jusqu'au budget ; au-delà, seul le DÉPASSEMENT passe au rouge.
 * Un mois sans relevé n'a que ses revenus ; un mois sans revenu complet, que son budget et son
 * dépensé.
 */
function MonthBar({ x = 0, y = 0, width = 0, height = 0, payload }: { x?: number; y?: number; width?: number; height?: number; payload?: ChartPoint }) {
  if (!payload || payload.top <= 0 || height <= 0) return <g />
  const base = y + height
  const scale = height / payload.top
  const at = (value: number) => base - value * scale
  const inset = Math.min(4, width / 6)
  const inner = { x: x + inset, width: Math.max(0, width - 2 * inset) }
  const budget = Math.max(payload.budget ?? 0, 0)
  const spent = payload.spent ?? 0
  const within = Math.min(spent, budget)
  const excess = Math.max(0, spent - budget)
  return (
    <g>
      {payload.income !== null && (
        <rect x={x} y={at(payload.income)} width={width} height={payload.income * scale} rx={3} fill="none" stroke={INCOME_COLOR} strokeWidth={1.5} strokeDasharray={DASH} />
      )}
      {payload.budget !== null && budget > 0 && (
        <rect {...inner} y={at(budget)} height={budget * scale} rx={2} fill="none" stroke={TOTAL_COLOR} strokeWidth={1.5} strokeDasharray={DASH} />
      )}
      {within > 0 && <rect {...inner} y={at(within)} height={within * scale} rx={2} fill={TOTAL_COLOR} className="spend-bar spend-within" filter={BAR_FILTER} />}
      {excess > 0 && <rect {...inner} y={at(spent)} height={excess * scale} rx={2} fill="var(--color-danger)" className="spend-bar spend-excess" filter={BAR_FILTER} />}
    </g>
  )
}

/**
 * Un repère de mois. Le graphique va d'un bord à l'autre du contenu : le premier repère s'aligne
 * sur le bord gauche de sa barre, le dernier sur le bord droit de la sienne, les autres se
 * centrent — sans quoi les deux extrêmes déborderaient du cadre.
 */
function EdgeTick({ x, y, payload, index = 0, last, half }: { x?: number; y?: number; payload?: { value: string }; index?: number; last: number; half: number }) {
  if (x === undefined || y === undefined || !payload) return <g />
  const anchor = index === 0 && last > 0 ? 'start' : index === last ? 'end' : 'middle'
  const at = anchor === 'start' ? x - half : anchor === 'end' ? x + half : x
  return (
    <text x={at} y={y} dy={12} textAnchor={anchor} fill="var(--color-muted)" fontSize={12}>
      {shortMonthLabel(payload.value)}
    </text>
  )
}

/**
 * Le mois en chiffres, une barre par mois (cf. `MonthBar`) : les revenus, le budget qu'ils
 * financent, et le dépensé qui le remplit — en rouge ce qui le dépasse. Comme les autres
 * graphiques : pas d'ordonnée, l'échelle part de zéro, les montants — et le reste à vivre — sont
 * dans l'infobulle ; les mois du plus ancien au plus récent.
 */
export default function SpendingChart({ points }: { points: FillPoint[] }) {
  const data: ChartPoint[] = points.map((p) => ({ ...p, top: Math.max(p.income ?? 0, p.budget ?? 0, p.spent ?? 0) }))
  const ticks = monthTicks(data.length).map((i) => data[i].month)
  const high = niceCeiling(Math.max(...data.map((p) => p.top), 0))
  // Une barre étroite quand il y a beaucoup de mois, jamais plus large qu'un pouce.
  const barSize = Math.max(12, Math.min(40, Math.floor(300 / Math.max(points.length, 1))))
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
    <div className="chart-body" role="img" aria-label={`Revenus, budget et dépensé par mois : ${described.join(' ; ')}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }} barSize={barSize}>
          <XAxis
            dataKey="month"
            // Au plus quatre repères, le dernier toujours montré : douze mois ne tiennent pas côte à côte.
            ticks={ticks}
            interval={0}
            tick={(props: { x?: number; y?: number; payload?: { value: string }; index?: number }) => <EdgeTick {...props} last={ticks.length - 1} half={barSize / 2} />}
            axisLine={{ stroke: 'var(--color-border)' }}
            tickLine={false}
          />
          <YAxis hide domain={[0, high]} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--color-border)', opacity: 0.4 }} />
          <Bar dataKey="top" shape={(props: unknown) => <MonthBar {...(props as Parameters<typeof MonthBar>[0])} />} isAnimationActive={false} name="Mois" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
