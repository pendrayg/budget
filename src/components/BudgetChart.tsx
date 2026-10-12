import { useRef } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatEuro } from '../lib/format'
import { monthLabel } from '../lib/month'
import { INCOME_COLOR, TOTAL_COLOR } from '../lib/palette'
import type { BudgetPoint } from '../lib/summary'
import { MonthTick, monthTicks, niceCeiling, useGroove } from './ChartParts'

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: BudgetPoint & { delta: number | null } }> }) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{monthLabel(point.month)}</div>
      <div className="chart-tooltip-row">
        <span className="muted">Budget</span>
        <span>{formatEuro(point.total)}</span>
      </div>
      {point.income !== null && (
        <div className="chart-tooltip-row">
          <span className="muted">Revenus</span>
          <span>{formatEuro(point.income)}</span>
        </div>
      )}
      {point.delta !== null && (
        <div className="chart-tooltip-row">
          <span className="muted">Changement</span>
          <span>
            {point.delta > 0 ? '+' : ''}
            {formatEuro(point.delta)}
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * L'évolution du total du budget. Un ESCALIER et non une courbe lissée : le total ne bouge
 * qu'aux modifications, et reste exactement le même entre deux. Une marche est un changement ;
 * un point la marque, les mois sans changement n'en portent pas, le début de la courbe non plus.
 *
 * La ligne est entaillée dans la page comme toute marque de graphique du DS (cf. `useGroove`).
 *
 * En pointillé gris, le revenu du foyer, mois par mois (tous les revenus ; un mois incomplet laisse un trou).
 * L'échelle part de zéro, et son haut est le plus haut des revenus ou des totaux : la hauteur de
 * la ligne du budget dit le total, et un budget ajouté la fait monter vers les revenus. Ajustée
 * sur les totaux seuls, l'échelle suivait chaque ajout — tout montait avec elle, et le dessin ne
 * bougeait pas. Pas de légende : l'infobulle nomme les deux lignes, mois par mois.
 */
export default function BudgetChart({ history }: { history: BudgetPoint[] }) {
  const frame = useRef<HTMLDivElement>(null)
  useGroove(frame)
  const data = history.map((point, index) => ({
    ...point,
    x: index,
    delta: point.changed && index > 0 ? point.total - history[index - 1].total : null,
  }))
  // Le dernier palier court jusqu'à la fin du mois en cours : sans ce point de fin, un changement
  // de ce mois-ci ne serait qu'un trait vertical, sans la marche qu'il pose.
  const last = data[data.length - 1]
  // Le revenu, lui, est celui d'un mois : il ne se prolonge pas au-delà.
  const plotted = [...data, { ...last, x: data.length, changed: false, income: null, end: true }]

  const totals = data.map((point) => point.total)
  const incomes = data.map((point) => point.income ?? 0)
  const high = niceCeiling(Math.max(...totals, ...incomes))

  return (
    <div ref={frame} className="chart-body" role="img" aria-label={`Évolution du total du budget, de ${formatEuro(totals[0])} à ${formatEuro(totals[totals.length - 1])}${data.some((point) => point.income !== null) ? ', face aux revenus du foyer' : ''}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={plotted} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="x"
            type="number"
            domain={[0, data.length]}
            ticks={monthTicks(data.length).map((i) => (i === data.length - 1 && data.length > 1 ? data.length : i))}
            // Les repères sont déjà choisis (au plus quatre) : tous s'affichent, le premier compris.
            interval={0}
            tick={<MonthTick months={data.map((point) => point.month)} />}
            axisLine={{ stroke: 'var(--color-border)' }}
            tickLine={false}
          />
          {/* Pas d'ordonnée : l'escalier se lit par ses marches, et le montant exact est dans
              l'infobulle. L'axe reste, caché, pour fixer l'échelle. */}
          <YAxis hide domain={[0, high]} />
          <Line
            type="linear"
            dataKey="income"
            stroke={INCOME_COLOR}
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            activeDot={{ r: 4, fill: INCOME_COLOR, stroke: 'var(--color-bg)', strokeWidth: 2 }}
            isAnimationActive={false}
            name="Revenus"
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--color-border)', strokeWidth: 1 }} />
          <Line
            className="serie-rainuree"
            type="stepAfter"
            dataKey="total"
            stroke={TOTAL_COLOR}
            strokeWidth={2}
            dot={(props: { cx?: number; cy?: number; index?: number; payload?: BudgetPoint }) => {
              if (props.cx === undefined || props.cy === undefined) return <g key={props.index} />
              // Le début de la courbe n'est pas un changement : pas de point. Il en reste un,
              // invisible, qui donne au groupe une hauteur — une ligne plate, de hauteur nulle,
              // serait effacée par l'entaille (cf. useGroove).
              if (props.index === 0) return <circle key={props.index} cx={props.cx} cy={props.cy} r={4} fill="transparent" />
              return props.payload?.changed ? (
                <circle key={props.index} cx={props.cx} cy={props.cy} r={4} fill={TOTAL_COLOR} stroke="var(--color-bg)" strokeWidth={2} />
              ) : (
                <g key={props.index} />
              )
            }}
            activeDot={{ r: 5, stroke: 'var(--color-bg)', strokeWidth: 2 }}
            isAnimationActive={false}
            name="Total"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
