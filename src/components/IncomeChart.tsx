import { useRef } from 'react'
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatEuro } from '../lib/format'
import { monthLabel } from '../lib/month'
import type { IncomePoint } from '../lib/summary'
import { colorOf, colorVar } from '../lib/colors'
import { peopleNames } from '../lib/people'
import type { Person } from '../lib/types'
import { MonthTick, monthTicks, niceCeiling, useGroove } from './ChartParts'

type Row = { x: number; month: string } & Record<string, number | string | null>

function ChartTooltip({ active, payload, people }: { active?: boolean; payload?: Array<{ payload?: Row }>; people: Person[] }) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{monthLabel(row.month)}</div>
      {people.map((person, index) => (
        <div className="chart-tooltip-person" key={person.id}>
          <div className="chart-tooltip-name">
            <span className="chart-swatch" style={{ background: colorVar(colorOf(people, index)) }} aria-hidden="true" />
            {person.name}
          </div>
          <div className="chart-tooltip-row">
            <span className="muted">Revenu</span>
            <span>{typeof row[`income-${person.id}`] === 'number' ? formatEuro(row[`income-${person.id}`] as number) : '—'}</span>
          </div>
          <div className="chart-tooltip-row">
            <span className="muted">Reste à vivre</span>
            <RemainingValue value={row[`remaining-${person.id}`]} />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Un reste à vivre dans l'infobulle : en rouge sous zéro, comme sa courbe. */
function RemainingValue({ value }: { value: number | string | null | undefined }) {
  if (typeof value !== 'number') return <span>—</span>
  return <span className={value < 0 ? 'spend-over' : undefined}>{formatEuro(value)}</span>
}

/**
 * Le trait d'un reste à vivre : sa couleur au-dessus de zéro, le rouge en dessous. Une courbe qui
 * passe sous zéro prend un dégradé à arêtes franches, coupé à la hauteur du zéro dans SA boîte
 * (de son plus haut à son plus bas point) ; une courbe toute en dessous est rouge, une toute
 * au-dessus garde sa couleur — et un trait plat, sans hauteur, ne saurait porter de dégradé.
 */
function remainingStroke(values: number[], color: string, gradientId: string): { stroke: string; gradient: { id: string; offset: number; color: string } | null } {
  const max = Math.max(...values)
  const min = Math.min(...values)
  if (values.length === 0 || min >= 0) return { stroke: color, gradient: null }
  if (max <= 0) return { stroke: 'var(--color-danger)', gradient: null }
  return { stroke: `url(#${gradientId})`, gradient: { id: gradientId, offset: max / (max - min), color } }
}

/**
 * Les revenus saisis, mois par mois : une ligne pleine par personne, et en pointillé, de la même
 * couleur, ce qui lui reste une fois sa part versée. L'écart entre les deux est sa part du budget.
 *
 * Deux séries par personne : la couleur dit QUI, le trait dit QUOI (plein : le revenu,
 * pointillé : le reste). La légende est la synthèse au-dessus : le revenu moyen de chacun y est
 * souligné d'un trait plein de sa couleur, son reste à vivre d'un pointillé. L'échelle part de
 * zéro, sans ordonnée affichée comme le graphique du budget : les montants sont dans l'infobulle.
 * Le zéro est marqué ; un reste à vivre négatif descend en dessous, en rouge.
 */
export default function IncomeChart({ history, people }: { history: IncomePoint[]; people: Person[] }) {
  const frame = useRef<HTMLDivElement>(null)
  useGroove(frame)

  const data: Row[] = history.map((point, index) => {
    const row: Row = { x: index, month: point.month }
    for (const person of people) {
      row[`income-${person.id}`] = point.income[person.id]
      row[`remaining-${person.id}`] = point.remaining[person.id]
    }
    return row
  })
  const values = history.flatMap((point) => people.map((person) => point.income[person.id] ?? 0))
  const high = niceCeiling(Math.max(...values, 0))
  // Sous zéro, l'échelle descend juste assez pour le plus bas des restes à vivre.
  const remainingOf = (personId: string) => history.map((point) => point.remaining[personId]).filter((value): value is number => value !== null)
  const lowest = Math.min(0, ...people.flatMap((person) => remainingOf(person.id)))
  const low = lowest < 0 ? -niceCeiling(-lowest) : 0
  const months = history.map((point) => point.month)
  const last = data.length - 1
  const colors = people.map((_, index) => colorVar(colorOf(people, index)))
  const strokes = people.map((person, index) => remainingStroke(remainingOf(person.id), colors[index], `reste-${person.id}`))

  return (
    <div className="income-chart">
      <div ref={frame} className="chart-body" role="img" aria-label={`Revenus de ${peopleNames(people)} et leur reste à vivre, de ${monthLabel(months[0])} à ${monthLabel(months[last])}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="x"
              type="number"
              domain={[0, Math.max(last, 1)]}
              ticks={monthTicks(data.length)}
              interval={0}
              tick={<MonthTick months={months} />}
              axisLine={{ stroke: 'var(--color-border)' }}
              tickLine={false}
            />
            <YAxis hide domain={[low, high]} />
            <defs>
              {strokes.map(
                ({ gradient }) =>
                  gradient && (
                    <linearGradient key={gradient.id} id={gradient.id} x1="0" y1="0" x2="0" y2="1">
                      <stop offset={0} style={{ stopColor: gradient.color }} />
                      <stop offset={gradient.offset} style={{ stopColor: gradient.color }} />
                      <stop offset={gradient.offset} style={{ stopColor: 'var(--color-danger)' }} />
                      <stop offset={1} style={{ stopColor: 'var(--color-danger)' }} />
                    </linearGradient>
                  ),
              )}
            </defs>
            {/* Le zéro, que le reste à vivre ne devrait pas franchir ; son étiquette seulement quand
                il est au-dessus de l'axe, sans quoi elle chevaucherait les mois. */}
            <ReferenceLine y={0} stroke="var(--color-muted)" strokeWidth={1} label={low < 0 ? { value: '0 €', position: 'insideTopLeft', fill: 'var(--color-muted)', fontSize: 12 } : undefined} ifOverflow="extendDomain" />
            <Tooltip content={<ChartTooltip people={people} />} cursor={{ stroke: 'var(--color-border)', strokeWidth: 1 }} />
            {people.flatMap((person, index) => [
              <Line
                key={`income-${person.id}`}
                className="serie-rainuree"
                type="linear"
                dataKey={`income-${person.id}`}
                name={`Revenu de ${person.name}`}
                stroke={colors[index]}
                strokeWidth={2}
                // Un mois isolé (sans voisin saisi) n'aurait sinon aucun trait : un point le montre.
                dot={data.length === 1 ? { r: 4, fill: colors[index], stroke: 'var(--color-bg)', strokeWidth: 2 } : false}
                activeDot={{ r: 5, fill: colors[index], stroke: 'var(--color-bg)', strokeWidth: 2 }}
                isAnimationActive={false}
              />,
              <Line
                key={`remaining-${person.id}`}
                type="linear"
                dataKey={`remaining-${person.id}`}
                name={`Reste à vivre de ${person.name}`}
                stroke={strokes[index].stroke}
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                activeDot={{ r: 4, fill: 'var(--color-bg)', stroke: colors[index], strokeWidth: 2 }}
                isAnimationActive={false}
              />,
            ])}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
