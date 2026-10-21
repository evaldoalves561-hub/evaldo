import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { DatasetVersion } from '../lib/types.ts'
import { compareVersions } from '../lib/diff.ts'
import { downloadCsv } from '../lib/csv.ts'
import { fmt, fmtCell, fmtDate, fmtPct, fmtSigned, fmtSignedPct } from '../lib/format.ts'
import { COLORS, Card, ChartTip, Delta, Insights, Kpi, axisProps } from './ui.tsx'

type Filter = 'todos' | 'novos' | 'removidos' | 'alterados'
const LIMIT = 300

export function CompareView({ versions, keyColumn }: { versions: DatasetVersion[]; keyColumn: string | null }) {
  const [aId, setAId] = useState(versions[versions.length - 2]?.id ?? '')
  const [bId, setBId] = useState(versions[versions.length - 1]?.id ?? '')
  const [filter, setFilter] = useState<Filter>('todos')
  const [query, setQuery] = useState('')
  const a = versions.find((v) => v.id === aId) ?? versions[versions.length - 2]
  const b = versions.find((v) => v.id === bId) ?? versions[versions.length - 1]
  const cmp = useMemo(() => (a && b ? compareVersions(a, b, keyColumn) : null), [a, b, keyColumn])

  const detail = useMemo(() => {
    if (!cmp) return []
    const keyCol = cmp.keyColumn
    const label = (row: Record<string, unknown>) =>
      Object.entries(row)
        .filter(([k]) => k !== keyCol)
        .slice(0, 3)
        .map(([, v]) => fmtCell(v))
        .join(' · ')
    const rows: { type: Filter; key: string; column: string; before: string; after: string; delta: number | null }[] = []
    if (filter === 'todos' || filter === 'alterados')
      for (const m of cmp.modified)
        for (const c of m.changes) rows.push({ type: 'alterados', key: m.key, column: c.column, before: fmtCell(c.before), after: fmtCell(c.after), delta: c.delta })
    if (filter === 'todos' || filter === 'novos')
      for (const r of cmp.added) rows.push({ type: 'novos', key: r.key, column: '—', before: '', after: keyCol ? label(r.row) : '', delta: null })
    if (filter === 'todos' || filter === 'removidos')
      for (const r of cmp.removed) rows.push({ type: 'removidos', key: r.key, column: '—', before: keyCol ? label(r.row) : '', after: '', delta: null })
    const q = query.trim().toLowerCase()
    return q ? rows.filter((r) => `${r.key} ${r.column} ${r.before} ${r.after}`.toLowerCase().includes(q)) : rows
  }, [cmp, filter, query])

  if (versions.length < 2 || !cmp || !a || !b) {
    return <div className="notice">É preciso ter pelo menos duas versões para comparar.</div>
  }

  const affected = cmp.added.length + cmp.removed.length + cmp.modified.length
  const colChart = cmp.columnStats.filter((s) => s.changed > 0).slice(0, 10)

  return (
    <>
      <div className="card toolbar" style={{ padding: '12px 16px' }}>
        <label className="field">
          Versão anterior
          <select className="select" value={a.id} onChange={(e) => setAId(e.target.value)}>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label} ({fmtDate(v.reference_date)})
              </option>
            ))}
          </select>
        </label>
        <span className="muted" style={{ alignSelf: 'flex-end', paddingBottom: 8 }}>→</span>
        <label className="field">
          Versão atual
          <select className="select" value={b.id} onChange={(e) => setBId(e.target.value)}>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label} ({fmtDate(v.reference_date)})
              </option>
            ))}
          </select>
        </label>
        <span className="muted small" style={{ alignSelf: 'flex-end', paddingBottom: 8, marginLeft: 'auto' }}>
          {cmp.keyColumn ? <>Registros identificados pela coluna <b>{cmp.keyColumn}</b></> : 'Sem coluna-chave: comparando linhas inteiras'}
        </span>
      </div>

      <div className="grid kpis">
        <Kpi label="Registros" value={fmt(cmp.totalAfter)} foot={<Delta value={cmp.totalAfter - cmp.totalBefore} text={`${fmtSigned(cmp.totalAfter - cmp.totalBefore)} (antes ${fmt(cmp.totalBefore)})`} />} />
        <Kpi label="Novos" value={fmt(cmp.added.length)} color={COLORS.added} foot="entraram nesta versão" />
        <Kpi label="Removidos" value={fmt(cmp.removed.length)} color={COLORS.removed} foot="saíram nesta versão" />
        <Kpi label="Alterados" value={fmt(cmp.modified.length)} color={COLORS.modified} foot={`${fmt(cmp.cellChanges.length)} valores mudaram`} />
        <Kpi label="Sem alteração" value={fmt(cmp.unchanged)} foot={`${fmtPct(1 - affected / Math.max(cmp.totalBefore, cmp.totalAfter, 1))} da base`} />
      </div>

      <Card title="Principais conclusões" subtitle="Resumo automático do que mudou entre as duas versões">
        <Insights items={cmp.insights} />
      </Card>

      <div className="grid two">
        <Card title="Alterações por coluna" subtitle="Quantos valores mudaram em cada coluna">
          {colChart.length ? (
            <ResponsiveContainer width="100%" height={Math.max(160, colChart.length * 34 + 30)}>
              <BarChart data={colChart} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }} barCategoryGap="25%">
                <CartesianGrid stroke={COLORS.grid} horizontal={false} />
                <XAxis type="number" {...axisProps} allowDecimals={false} />
                <YAxis type="category" dataKey="column" {...axisProps} width={120} />
                <Tooltip content={<ChartTip />} cursor={{ fill: 'var(--surface-2)' }} />
                <Bar dataKey="changed" name="Alterações" fill={COLORS.s1} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="muted">Nenhum valor alterado{cmp.keyColumn ? '' : ' (defina a coluna-chave para detectar alterações)'}.</p>
          )}
        </Card>

        <Card title="Totais das colunas numéricas" subtitle="Soma e média antes e depois">
          {cmp.numeric.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Coluna</th>
                    <th className="num">Antes</th>
                    <th className="num">Depois</th>
                    <th className="num">Variação</th>
                    <th className="num">Média</th>
                  </tr>
                </thead>
                <tbody>
                  {cmp.numeric.map((n) => (
                    <tr key={n.column}>
                      <td>{n.column}</td>
                      <td className="num">{fmt(n.sumBefore)}</td>
                      <td className="num">{fmt(n.sumAfter)}</td>
                      <td className="num">
                        <Delta value={n.delta} text={n.pct !== null ? fmtSignedPct(n.pct) : fmtSigned(n.delta)} />
                      </td>
                      <td className="num muted">
                        {fmt(n.avgBefore)} → {fmt(n.avgAfter)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">Nenhuma coluna numérica em comum.</p>
          )}
        </Card>
      </div>

      {cmp.topMovers.length > 0 && (
        <Card title="Maiores variações individuais" subtitle="Valores numéricos que mais mudaram, em valor absoluto">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Registro</th>
                  <th>Coluna</th>
                  <th className="num">Antes</th>
                  <th className="num">Depois</th>
                  <th className="num">Variação</th>
                  <th className="num">%</th>
                </tr>
              </thead>
              <tbody>
                {cmp.topMovers.map((m, i) => (
                  <tr key={i}>
                    <td><b>{m.key}</b></td>
                    <td>{m.column}</td>
                    <td className="num muted">{fmtCell(m.before)}</td>
                    <td className="num">{fmtCell(m.after)}</td>
                    <td className="num"><Delta value={m.delta} text={fmtSigned(m.delta)} /></td>
                    <td className="num">{fmtSignedPct(m.pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card
        title="Todas as diferenças"
        subtitle={`${fmt(detail.length)} itens${detail.length > LIMIT ? `, mostrando os primeiros ${LIMIT}` : ''}`}
        actions={
          <div className="toolbar">
            <select className="select" value={filter} onChange={(e) => setFilter(e.target.value as Filter)} aria-label="Tipo de diferença">
              <option value="todos">Todos os tipos</option>
              <option value="novos">Novos</option>
              <option value="removidos">Removidos</option>
              <option value="alterados">Alterados</option>
            </select>
            <input className="input" placeholder="Buscar…" value={query} onChange={(e) => setQuery(e.target.value)} />
            <button
              className="btn"
              onClick={() =>
                downloadCsv(
                  `diferencas_${a.label}_${b.label}.csv`,
                  ['Tipo', cmp.keyColumn ?? 'Registro', 'Coluna', 'Antes', 'Depois', 'Variação'],
                  detail.map((d) => [d.type, d.key, d.column, d.before, d.after, d.delta ?? '']),
                )
              }
            >
              Exportar CSV
            </button>
          </div>
        }
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>{cmp.keyColumn ?? 'Registro'}</th>
                <th>Coluna</th>
                <th>Antes</th>
                <th>Depois</th>
                <th className="num">Variação</th>
              </tr>
            </thead>
            <tbody>
              {detail.slice(0, LIMIT).map((d, i) => (
                <tr key={i}>
                  <td>
                    <span className={`badge ${d.type === 'novos' ? 'added' : d.type === 'removidos' ? 'removed' : 'modified'}`}>
                      {d.type === 'novos' ? 'Novo' : d.type === 'removidos' ? 'Removido' : 'Alterado'}
                    </span>
                  </td>
                  <td><b>{d.key}</b></td>
                  <td>{d.column}</td>
                  <td className={d.type === 'alterados' ? 'before' : 'muted'}>{d.before}</td>
                  <td className={d.type === 'alterados' ? 'after' : ''}>{d.after}</td>
                  <td className="num">{d.delta !== null ? <Delta value={d.delta} text={fmtSigned(d.delta)} /> : ''}</td>
                </tr>
              ))}
              {detail.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                    Nenhuma diferença encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}
