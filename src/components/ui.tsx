import type { ReactNode } from 'react'
import type { Insight } from '../lib/diff.ts'
import { fmt } from '../lib/format.ts'

export function Card({ title, subtitle, actions, children }: { title?: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="card">
      {(title || actions) && (
        <div className="card-head">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}

export function Kpi({ label, value, foot, color }: { label: string; value: ReactNode; foot?: ReactNode; color?: string }) {
  return (
    <div className="card kpi">
      <div className="label">
        {color && <span className="dot" style={{ background: color }} />}
        {label}
      </div>
      <div className="value">{value}</div>
      {foot && <div className="foot">{foot}</div>}
    </div>
  )
}

export function Delta({ value, text, invert = false }: { value: number | null; text: string; invert?: boolean }) {
  if (value === null || value === 0) return <span className="delta">{text}</span>
  const good = invert ? value < 0 : value > 0
  return (
    <span className={`delta ${good ? 'up' : 'down'}`}>
      {value > 0 ? '▲' : '▼'} {text}
    </span>
  )
}

const ICON: Record<Insight['tone'], string> = { up: '✓', down: '!', neutral: 'i', warn: '!' }

export function Insights({ items }: { items: Insight[] }) {
  return (
    <div className="insights">
      {items.map((it, i) => (
        <div key={i} className={`insight ${it.tone}`}>
          <div className="icon" aria-hidden>
            {ICON[it.tone]}
          </div>
          <div>
            <h3>{it.title}</h3>
            <p>{it.detail}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

interface TipEntry {
  name?: string | number
  value?: number | string | readonly (number | string)[]
  color?: string
  dataKey?: string | number | ((obj: unknown) => unknown)
}

/** Tooltip padrão dos gráficos: rótulo + valores com a cor da série ao lado. */
export function ChartTip({ active, payload, label, format = fmt }: { active?: boolean; payload?: readonly TipEntry[]; label?: ReactNode; format?: (n: number) => string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tip">
      <div className="t">{label}</div>
      {payload.map((p, i) => (
        <div className="r" key={i}>
          <span>
            <span className="dot" style={{ background: p.color }} />
            {p.name}
          </span>
          <b className="num">{typeof p.value === 'number' ? format(p.value) : String(p.value)}</b>
        </div>
      ))}
    </div>
  )
}

export const COLORS = {
  s1: 'var(--s1)',
  s2: 'var(--s2)',
  s3: 'var(--s3)',
  s7: 'var(--s7)',
  added: 'var(--good)',
  removed: 'var(--critical)',
  modified: 'var(--warning)',
  grid: 'var(--grid)',
  muted: 'var(--muted)',
}

export const axisProps = {
  tick: { fill: 'var(--muted)', fontSize: 12 },
  axisLine: { stroke: 'var(--border)' },
  tickLine: false,
} as const
