import { useMemo, useState } from 'react'
import type { BaseId, Bases, Fechamento } from '../lib/types.ts'
import { BASES, BASE_BY_ID, findCol } from '../lib/fechamento.ts'
import { downloadCsv } from '../lib/csv.ts'
import { fmt, fmtCell } from '../lib/format.ts'
import { Card } from './ui.tsx'

const LIMIT = 300

export function BasesView({ cur, bases }: { cur: Fechamento; bases: Bases }) {
  const [baseId, setBaseId] = useState<BaseId>('alteracoes')
  const [query, setQuery] = useState('')
  const [regional, setRegional] = useState('')
  const def = BASE_BY_ID[baseId]
  const table = bases[baseId]
  const regCol = table ? findCol(table.columns, def.dims.find((d) => /regional/i.test(d.col))!.col) : null
  const regionais = useMemo(() => (table && regCol ? [...new Set(table.rows.map((r) => String(r[regCol] ?? '')))].filter(Boolean).sort() : []), [table, regCol])
  const rows = useMemo(() => {
    if (!table) return []
    const q = query.trim().toLowerCase()
    return table.rows.filter((r) => (!regional || String(r[regCol ?? ''] ?? '') === regional) && (!q || Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(q))))
  }, [table, query, regional, regCol])

  return (
    <>
      <div className="segmented" style={{ alignSelf: 'flex-start' }}>
        {BASES.map((b) => (
          <button key={b.id} className={b.id === baseId ? 'active' : ''} onClick={() => setBaseId(b.id)}>
            {b.short}
          </button>
        ))}
      </div>
      {!table ? (
        <div className="notice">Esta base não foi encontrada neste fechamento.</div>
      ) : (
        <Card
          title={def.title}
          subtitle={`${fmt(rows.length)} de ${fmt(table.rows.length)} linhas${rows.length > LIMIT ? `, mostrando as primeiras ${LIMIT}` : ''}`}
          actions={
            <div className="toolbar">
              {regionais.length > 0 && (
                <select className="select" value={regional} onChange={(e) => setRegional(e.target.value)} aria-label="Regional">
                  <option value="">Todas as regionais</option>
                  {regionais.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              )}
              <input className="input" placeholder="Buscar em todas as colunas…" value={query} onChange={(e) => setQuery(e.target.value)} />
              <button className="btn" onClick={() => downloadCsv(`${def.id}_${cur.label}.csv`, table.columns, rows.map((r) => table.columns.map((c) => r[c])))}>
                Exportar CSV
              </button>
            </div>
          }
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {table.columns.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, LIMIT).map((r, i) => (
                  <tr key={i}>
                    {table.columns.map((c) => (
                      <td key={c} className={typeof r[c] === 'number' ? 'num small' : 'small'} style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={String(r[c] ?? '')}>
                        {r[c] === null ? '' : fmtCell(r[c])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  )
}
