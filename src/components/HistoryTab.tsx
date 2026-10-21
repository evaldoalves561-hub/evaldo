import { useMemo, useState } from 'react'
import type { DatasetVersion } from '../lib/types.ts'
import { trackRecord } from '../lib/history.ts'
import { fmt, fmtCell, fmtDate } from '../lib/format.ts'
import { Card } from './ui.tsx'

export function HistoryTab({ versions, keyColumn, onDelete }: { versions: DatasetVersion[]; keyColumn: string | null; onDelete: (v: DatasetVersion) => void }) {
  const [keyValue, setKeyValue] = useState('')
  const keys = useMemo(() => {
    if (!keyColumn) return []
    const set = new Set<string>()
    for (const v of versions) for (const r of v.rows) if (r[keyColumn] !== null && r[keyColumn] !== undefined) set.add(String(r[keyColumn]).trim())
    return [...set].slice(0, 5000)
  }, [versions, keyColumn])
  const trail = useMemo(() => (keyColumn && keyValue ? trackRecord(versions, keyColumn, keyValue) : null), [versions, keyColumn, keyValue])
  const changedCols = trail ? trail.columns.filter((c) => trail.entries.some((e) => e.changed.has(c))) : []
  const shownCols = trail ? [...changedCols, ...trail.columns.filter((c) => !changedCols.includes(c))].slice(0, 10) : []

  return (
    <>
      <Card title="Rastrear um registro" subtitle="Veja como um registro mudou em todas as versões">
        {!keyColumn ? (
          <p className="muted">Defina a coluna-chave da tabela (no topo da página) para rastrear registros.</p>
        ) : (
          <>
            <div className="toolbar">
              <input className="input" list="keys" placeholder={`Digite o valor de "${keyColumn}"`} value={keyValue} onChange={(e) => setKeyValue(e.target.value)} style={{ minWidth: 260 }} />
              <datalist id="keys">
                {keys.map((k) => (
                  <option key={k} value={k} />
                ))}
              </datalist>
              {trail && (
                <span className="muted small">
                  {changedCols.length ? `Colunas que mudaram: ${changedCols.join(', ')}` : 'Nenhuma alteração neste registro'}
                </span>
              )}
            </div>
            {trail && (
              <div className="table-wrap" style={{ marginTop: 14 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Versão</th>
                      <th>Situação</th>
                      {shownCols.map((c) => (
                        <th key={c}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {trail.entries.map((e, i) => (
                      <tr key={i}>
                        <td>
                          <b>{e.label}</b>
                          <div className="small muted">{fmtDate(e.date)}</div>
                        </td>
                        <td>{e.present ? (e.changed.size ? <span className="badge modified">Alterado</span> : <span className="badge">Presente</span>) : <span className="badge removed">Ausente</span>}</td>
                        {shownCols.map((c) => (
                          <td key={c} className={e.changed.has(c) ? 'cell-changed' : ''}>
                            {e.present ? fmtCell(e.values[c]) : ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Card>

      <Card title="Versões enviadas" subtitle="Em ordem cronológica pela data de referência">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Versão</th>
                <th>Data de referência</th>
                <th>Arquivo</th>
                <th className="num">Registros</th>
                <th className="num">Colunas</th>
                <th>Enviada em</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {[...versions].reverse().map((v) => (
                <tr key={v.id}>
                  <td><b>{v.label}</b></td>
                  <td>{fmtDate(v.reference_date)}</td>
                  <td className="muted">{v.file_name ?? '—'}</td>
                  <td className="num">{fmt(v.rows.length)}</td>
                  <td className="num">{v.columns.length}</td>
                  <td className="muted">{new Date(v.created_at).toLocaleString('pt-BR')}</td>
                  <td>
                    <button className="btn ghost danger small" onClick={() => onDelete(v)}>
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}
