import { useMemo, useState } from 'react'
import type { BaseId, Bases, Fechamento } from '../lib/types.ts'
import { BASES, BASE_BY_ID, KEY_COL, compareBase, findCol, rowValue } from '../lib/fechamento.ts'
import { downloadCsv } from '../lib/csv.ts'
import { fmt, fmtBRL, fmtCell, fmtSigned } from '../lib/format.ts'
import { COLORS, Card, Delta, Kpi } from './ui.tsx'

type Tipo = 'todos' | 'novos' | 'saiu' | 'alterados'
const LIMIT = 400

const TEXTS: Record<BaseId, { novos: string; saiu: string; alterados: string; novo1: string; saiu1: string }> = {
  alteracoes: { novos: 'Novos lançamentos', saiu: 'Saíram do relatório', alterados: 'Valores alterados', novo1: 'Novo', saiu1: 'Saiu' },
  info_uau: { novos: 'Novos erros', saiu: 'Erros corrigidos', alterados: 'Erros com dados alterados', novo1: 'Novo erro', saiu1: 'Corrigido' },
  acomp_entregas: { novos: 'Novas pendências', saiu: 'Entregas concluídas', alterados: 'Pendências alteradas', novo1: 'Nova', saiu1: 'Concluída' },
}

export function RegistrosView({ cur, curBases, prev, prevBases }: { cur: Fechamento; curBases: Bases; prev: Fechamento | null; prevBases: Bases | null }) {
  const [baseId, setBaseId] = useState<BaseId>('info_uau')
  const [tipo, setTipo] = useState<Tipo>('todos')
  const [query, setQuery] = useState('')
  const [regional, setRegional] = useState('')
  const def = BASE_BY_ID[baseId]
  const t = TEXTS[baseId]
  const curT = curBases[baseId]
  const prevT = prevBases?.[baseId]
  const cmp = useMemo(() => compareBase(def, prevT, curT), [def, prevT, curT])

  const items = useMemo(() => {
    if (!cmp || !curT || !prevT) return []
    const regCol = findCol(curT.columns, def.dims.find((d) => /regional/i.test(d.col))!.col)
    const descCols = def.dims.filter((d) => !/regional/i.test(d.col)).slice(0, 2).map((d) => findCol(curT.columns, d.col)).filter(Boolean) as string[]
    const desc = (r: Record<string, unknown>) => descCols.map((c) => fmtCell(r[c] as never)).join(' · ')
    const out: { tipo: Tipo; key: string; regional: string; desc: string; valor: number | null; detalhe: string; delta: number | null }[] = []
    for (const a of cmp.added) out.push({ tipo: 'novos', key: String(a.row[KEY_COL]), regional: String(a.row[regCol ?? ''] ?? ''), desc: desc(a.row), valor: def.value ? rowValue(def, curT, a.row) : null, detalhe: '', delta: null })
    for (const r of cmp.removed) out.push({ tipo: 'saiu', key: String(r.row[KEY_COL]), regional: String(r.row[regCol ?? ''] ?? ''), desc: desc(r.row), valor: def.value ? rowValue(def, prevT, r.row) : null, detalhe: '', delta: null })
    for (const m of cmp.modified) {
      const valCol = def.value ? findCol(curT.columns, def.value) : null
      const dv = m.changes.find((c) => c.column === valCol)?.delta ?? null
      out.push({
        tipo: 'alterados',
        key: m.key,
        regional: String(m.after[regCol ?? ''] ?? ''),
        desc: desc(m.after),
        valor: def.value ? rowValue(def, curT, m.after) : null,
        detalhe: m.changes.map((c) => `${c.column}: ${fmtCell(c.before)} → ${fmtCell(c.after)}`).join('; '),
        delta: dv,
      })
    }
    return out
  }, [cmp, curT, prevT, def])

  const regionais = useMemo(() => [...new Set(items.map((i) => i.regional).filter(Boolean))].sort(), [items])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter(
      (i) => (tipo === 'todos' || i.tipo === tipo) && (!regional || i.regional === regional) && (!q || `${i.key} ${i.desc} ${i.detalhe}`.toLowerCase().includes(q)),
    )
  }, [items, tipo, query, regional])

  const sumVal = (tp: Tipo) => items.filter((i) => i.tipo === tp).reduce((s, i) => s + (i.valor ?? 0), 0)

  return (
    <>
      <div className="toolbar">
        <div className="segmented">
          {BASES.map((b) => (
            <button key={b.id} className={b.id === baseId ? 'active' : ''} onClick={() => setBaseId(b.id)}>
              {b.short}
            </button>
          ))}
        </div>
        <span className="muted small">{prev ? `${prev.label} → ${cur.label}` : ''}</span>
      </div>

      {!prev ? (
        <div className="notice">Escolha um fechamento anterior no topo da página para comparar os registros.</div>
      ) : !cmp ? (
        <div className="notice">Esta base não existe em um dos dois fechamentos.</div>
      ) : (
        <>
          <div className="grid kpis">
            <Kpi label={t.novos} color={COLORS.removed} value={fmt(cmp.added.length)} foot={def.value ? fmtBRL(sumVal('novos')) : 'não estavam no anterior'} />
            <Kpi label={t.saiu} color={COLORS.added} value={fmt(cmp.removed.length)} foot={def.value ? fmtBRL(sumVal('saiu')) : 'não aparecem mais'} />
            <Kpi label={t.alterados} color={COLORS.modified} value={fmt(cmp.modified.length)} foot={`${fmt(cmp.cellChanges.length)} campos mudaram`} />
            <Kpi label="Sem alteração" value={fmt(cmp.unchanged)} foot="iguais nos dois fechamentos" />
          </div>
          <Card
            title="Registros que mudaram"
            subtitle={`${fmt(filtered.length)} registros${filtered.length > LIMIT ? `, mostrando os primeiros ${LIMIT}` : ''}. Chave: ${def.key.join(' + ')}`}
            actions={
              <div className="toolbar">
                <select className="select" value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)} aria-label="Tipo">
                  <option value="todos">Todos</option>
                  <option value="novos">{t.novos}</option>
                  <option value="saiu">{t.saiu}</option>
                  <option value="alterados">{t.alterados}</option>
                </select>
                <select className="select" value={regional} onChange={(e) => setRegional(e.target.value)} aria-label="Regional">
                  <option value="">Todas as regionais</option>
                  {regionais.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
                <input className="input" placeholder="Buscar…" value={query} onChange={(e) => setQuery(e.target.value)} />
                <button
                  className="btn"
                  onClick={() =>
                    downloadCsv(
                      `${def.id}_${prev.label}_${cur.label}.csv`,
                      ['Situação', 'Chave', 'Regional', 'Descrição', 'Valor', 'Alterações'],
                      filtered.map((i) => [i.tipo === 'novos' ? t.novo1 : i.tipo === 'saiu' ? t.saiu1 : 'Alterado', i.key, i.regional, i.desc, i.valor ?? '', i.detalhe]),
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
                    <th>Situação</th>
                    <th>Chave</th>
                    <th>Regional</th>
                    <th>{def.dims.filter((d) => !/regional/i.test(d.col)).slice(0, 2).map((d) => d.label).join(' · ')}</th>
                    {def.value && <th className="num">Valor</th>}
                    <th>O que mudou</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, LIMIT).map((i, idx) => (
                    <tr key={idx}>
                      <td>
                        <span className={`badge ${i.tipo === 'novos' ? 'removed' : i.tipo === 'saiu' ? 'added' : 'modified'}`}>
                          {i.tipo === 'novos' ? t.novo1 : i.tipo === 'saiu' ? t.saiu1 : 'Alterado'}
                        </span>
                      </td>
                      <td className="small"><b>{i.key}</b></td>
                      <td className="small">{i.regional}</td>
                      <td className="small">{i.desc}</td>
                      {def.value && (
                        <td className="num">
                          {fmtBRL(i.valor)}
                          {i.delta !== null && i.delta !== 0 && (
                            <div className="small">
                              <Delta value={i.delta} text={fmtSigned(i.delta)} invert />
                            </div>
                          )}
                        </td>
                      )}
                      <td className="small">{i.detalhe}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                        Nenhum registro encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </>
  )
}
