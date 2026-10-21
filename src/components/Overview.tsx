import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { History } from '../lib/history.ts'
import { fmt, fmtCompact, fmtDate, fmtSigned, fmtSignedPct } from '../lib/format.ts'
import { COLORS, Card, ChartTip, Delta, Kpi, axisProps } from './ui.tsx'

export function Overview({ history }: { history: History }) {
  const { points, numericColumns, columnVolatility, totals } = history
  const [metric, setMetric] = useState(numericColumns[0] ?? '')
  const activeMetric = numericColumns.includes(metric) ? metric : numericColumns[0]
  const last = points[points.length - 1]
  const prev = points[points.length - 2]
  const first = points[0]
  const rowDelta = prev ? last.rows - prev.rows : null
  const steps = points.slice(1)
  const maxVol = columnVolatility[0]?.changes ?? 0
  const data = points.map((p) => ({ ...p, name: p.label, ...Object.fromEntries(Object.entries(p.sums).map(([k, v]) => [`sum:${k}`, v])) }))

  return (
    <>
      <div className="grid kpis">
        <Kpi label="Versões enviadas" value={points.length} foot={`${fmtDate(first.date)} a ${fmtDate(last.date)}`} />
        <Kpi
          label="Registros na última versão"
          value={fmt(last.rows)}
          foot={rowDelta !== null ? <Delta value={rowDelta} text={`${fmtSigned(rowDelta)} vs ${prev.label}`} /> : 'primeira versão'}
        />
        <Kpi label="Registros novos (acumulado)" value={fmt(totals.added)} color={COLORS.added} foot={`desde ${first.label}`} />
        <Kpi label="Registros removidos (acumulado)" value={fmt(totals.removed)} color={COLORS.removed} foot={`desde ${first.label}`} />
        <Kpi label="Valores alterados (acumulado)" value={fmt(totals.cellChanges)} color={COLORS.modified} foot={`em ${fmt(totals.modified)} registros`} />
      </div>

      {points.length < 2 && <div className="notice">Envie mais uma versão desta tabela para ver as diferenças ao longo do tempo.</div>}

      <div className="grid two">
        <Card title="Quantidade de registros" subtitle="Total de linhas em cada versão">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={COLORS.grid} vertical={false} />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis {...axisProps} width={56} tickFormatter={fmtCompact} />
              <Tooltip content={<ChartTip />} cursor={{ stroke: 'var(--border)' }} />
              <Line type="monotone" dataKey="rows" name="Registros" stroke={COLORS.s1} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: 'var(--surface)' }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card
          title={activeMetric ? `Soma de "${activeMetric}"` : 'Colunas numéricas'}
          subtitle="Evolução do total da coluna escolhida"
          actions={
            numericColumns.length > 1 && (
              <select className="select" value={activeMetric} onChange={(e) => setMetric(e.target.value)} aria-label="Coluna numérica">
                {numericColumns.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            )
          }
        >
          {activeMetric ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={COLORS.grid} vertical={false} />
                <XAxis dataKey="name" {...axisProps} />
                <YAxis {...axisProps} width={64} tickFormatter={fmtCompact} />
                <Tooltip content={<ChartTip />} cursor={{ stroke: 'var(--border)' }} />
                <Line type="monotone" dataKey={`sum:${activeMetric}`} name={activeMetric} stroke={COLORS.s7} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: 'var(--surface)' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="muted">Nenhuma coluna numérica encontrada.</p>
          )}
        </Card>
      </div>

      {steps.length > 0 && (
        <div className="grid two">
          <Card title="Mudanças a cada atualização" subtitle="Registros novos, removidos e alterados em relação à versão anterior">
            <div className="legend" style={{ marginBottom: 8 }}>
              <span><span className="dot" style={{ background: COLORS.added }} />Novos</span>
              <span><span className="dot" style={{ background: COLORS.removed }} />Removidos</span>
              <span><span className="dot" style={{ background: COLORS.modified }} />Alterados</span>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={steps.map((p) => ({ ...p, name: p.label }))} margin={{ top: 8, right: 16, left: 0, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid stroke={COLORS.grid} vertical={false} />
                <XAxis dataKey="name" {...axisProps} />
                <YAxis {...axisProps} width={48} allowDecimals={false} />
                <Tooltip content={<ChartTip />} cursor={{ fill: 'var(--surface-2)' }} />
                <Bar dataKey="added" name="Novos" stackId="a" fill={COLORS.added} stroke="var(--surface)" strokeWidth={1} />
                <Bar dataKey="removed" name="Removidos" stackId="a" fill={COLORS.removed} stroke="var(--surface)" strokeWidth={1} />
                <Bar dataKey="modified" name="Alterados" stackId="a" fill={COLORS.modified} stroke="var(--surface)" strokeWidth={1} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Colunas que mais mudam" subtitle="Alterações de valor somadas em todo o histórico">
            {columnVolatility.length === 0 ? (
              <p className="muted">Nenhum valor alterado até agora (é preciso definir a coluna-chave para detectar alterações).</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Coluna</th>
                    <th style={{ width: '40%' }}></th>
                    <th className="num">Alterações</th>
                    <th className="num">Mudou em</th>
                  </tr>
                </thead>
                <tbody>
                  {columnVolatility.slice(0, 8).map((c) => (
                    <tr key={c.column}>
                      <td>{c.column}</td>
                      <td>
                        <div className="bar-track">
                          <div className="bar-fill" style={{ width: `${(c.changes / maxVol) * 100}%` }} />
                        </div>
                      </td>
                      <td className="num">{fmt(c.changes)}</td>
                      <td className="num muted">
                        {c.versionsChanged} de {steps.length}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      <Card title="Resumo por versão" subtitle="Cada linha compara a versão com a anterior">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Versão</th>
                <th>Data</th>
                <th className="num">Registros</th>
                <th className="num">Variação</th>
                <th className="num">Novos</th>
                <th className="num">Removidos</th>
                <th className="num">Alterados</th>
                {numericColumns.slice(0, 3).map((c) => (
                  <th key={c} className="num">
                    Soma {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p) => {
                const i = points.indexOf(p)
                const before = points[i - 1]
                return (
                  <tr key={p.versionId}>
                    <td><b>{p.label}</b></td>
                    <td>{fmtDate(p.date)}</td>
                    <td className="num">{fmt(p.rows)}</td>
                    <td className="num">{before ? <Delta value={p.rows - before.rows} text={fmtSigned(p.rows - before.rows)} /> : '—'}</td>
                    <td className="num">{before ? fmt(p.added) : '—'}</td>
                    <td className="num">{before ? fmt(p.removed) : '—'}</td>
                    <td className="num">{before ? fmt(p.modified) : '—'}</td>
                    {numericColumns.slice(0, 3).map((c) => {
                      const d = before ? p.sums[c] - before.sums[c] : null
                      return (
                        <td key={c} className="num">
                          {fmt(p.sums[c])}
                          {d !== null && before.sums[c] !== 0 && (
                            <div className="small">
                              <Delta value={d} text={fmtSignedPct(d / Math.abs(before.sums[c]))} />
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}
