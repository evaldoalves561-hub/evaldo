import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Bases, Fechamento } from '../lib/types.ts'
import { BASE_BY_ID, kpis, summarize } from '../lib/fechamento.ts'
import { fmt, fmtBRL, fmtBRLCompact, fmtCompact, fmtPct, fmtSigned, fmtSignedBRL } from '../lib/format.ts'
import { COLORS, Card, ChartTip, Delta, axisProps } from './ui.tsx'

interface Item {
  f: Fechamento
  bases: Bases
}

const METRICS = [
  { key: 'valorArrastado', label: 'Valor arrastado', money: true },
  { key: 'erros', label: 'Erros de vínculo em aberto', money: false },
  { key: 'pedidosPendentes', label: 'Pedidos com entrega pendente', money: false },
  { key: 'valorPendente', label: 'Valor pendente de entrega', money: true },
  { key: 'atrasados', label: 'Pedidos atrasados', money: false },
  { key: 'lancamentosArrastados', label: 'Lançamentos arrastados', money: false },
] as const

const PIVOTS = [
  { id: 'arrastado', base: 'alteracoes', dim: 'REGIONAL', label: 'Valor arrastado por regional', money: true },
  { id: 'entidade', base: 'alteracoes', dim: 'Entidade', label: 'Valor arrastado por entidade', money: true },
  { id: 'erros', base: 'info_uau', dim: 'Regional', label: 'Erros por regional', money: false },
  { id: 'motivo', base: 'info_uau', dim: 'Motivo do Erro', label: 'Erros por motivo', money: false },
  { id: 'pendente', base: 'acomp_entregas', dim: 'Regional', label: 'Valor pendente por regional', money: true },
] as const

export function EvolucaoView({ items }: { items: Item[] }) {
  const series = useMemo(() => items.map(({ f, bases }) => ({ name: f.label, ...kpis(bases) })), [items])
  const [pivotId, setPivotId] = useState<(typeof PIVOTS)[number]['id']>('arrastado')
  const pivot = PIVOTS.find((p) => p.id === pivotId)!

  const table = useMemo(() => {
    const def = BASE_BY_ID[pivot.base]
    const cols = items.map(({ bases }) => {
      const s = summarize(def, bases[pivot.base])
      return new Map((s.groups[pivot.dim] ?? []).map((g) => [g.name, pivot.money ? g.total : g.qt]))
    })
    const names = [...new Set(cols.flatMap((m) => [...m.keys()]))]
    const rows = names.map((name) => ({ name, values: cols.map((m) => m.get(name) ?? 0) }))
    rows.sort((a, b) => b.values[b.values.length - 1] - a.values[a.values.length - 1])
    return rows
  }, [items, pivot])

  if (items.length < 2) return <div className="notice">Envie pelo menos dois fechamentos para ver a evolução ao longo do tempo.</div>

  const fmtV = pivot.money ? fmtBRL : fmt
  const n = items.length
  return (
    <>
      <div className="grid three">
        {METRICS.map((m) => {
          const last = series[n - 1][m.key]
          const before = series[n - 2][m.key]
          return (
            <Card key={m.key} title={m.label} subtitle={`${m.money ? fmtBRL(last) : fmt(last)} no último fechamento`}>
              <div className="small" style={{ marginTop: -8, marginBottom: 6 }}>
                <Delta value={last - before} text={`${m.money ? fmtSignedBRL(last - before) : fmtSigned(last - before)} vs anterior`} invert />
              </div>
              <ResponsiveContainer width="100%" height={170}>
                <LineChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={COLORS.grid} vertical={false} />
                  <XAxis dataKey="name" {...axisProps} interval="preserveStartEnd" />
                  <YAxis {...axisProps} width={m.money ? 72 : 44} tickFormatter={m.money ? fmtBRLCompact : fmtCompact} />
                  <Tooltip content={<ChartTip format={m.money ? fmtBRL : fmt} />} cursor={{ stroke: 'var(--border)' }} />
                  <Line type="monotone" dataKey={m.key} name={m.label} stroke={COLORS.s1} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: 'var(--surface)' }} activeDot={{ r: 6 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )
        })}
      </div>

      <Card
        title={pivot.label}
        subtitle="Cada coluna é um fechamento; a última coluna compara os dois mais recentes"
        actions={
          <div className="segmented">
            {PIVOTS.map((p) => (
              <button key={p.id} className={p.id === pivotId ? 'active' : ''} onClick={() => setPivotId(p.id)}>
                {p.label.replace(/^(Valor |Erros )/, (s) => s)}
              </button>
            ))}
          </div>
        }
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{pivot.dim === 'Motivo do Erro' ? 'Motivo' : pivot.dim === 'Entidade' ? 'Entidade' : 'Regional'}</th>
                {items.map(({ f }) => (
                  <th key={f.id} className="num">
                    {f.label}
                  </th>
                ))}
                <th className="num">Variação</th>
                <th className="num">%</th>
              </tr>
            </thead>
            <tbody>
              {table.map((r) => {
                const d = r.values[n - 1] - r.values[n - 2]
                return (
                  <tr key={r.name}>
                    <td>{r.name}</td>
                    {r.values.map((v, i) => (
                      <td key={i} className="num">
                        {v ? fmtV(v) : <span className="muted">—</span>}
                      </td>
                    ))}
                    <td className="num">
                      <Delta value={d} text={pivot.money ? fmtSignedBRL(d) : fmtSigned(d)} invert />
                    </td>
                    <td className="num muted">{r.values[n - 2] ? fmtPct(d / Math.abs(r.values[n - 2])) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                {items.map((_, i) => (
                  <td key={i} className="num">
                    {fmtV(table.reduce((s, r) => s + r.values[i], 0))}
                  </td>
                ))}
                <td className="num" colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </>
  )
}
