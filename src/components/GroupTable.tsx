import { useState } from 'react'
import type { MergedGroup } from '../lib/fechamento.ts'
import { fmt, fmtBRL, fmtPct, fmtSigned, fmtSignedBRL } from '../lib/format.ts'
import { Delta } from './ui.tsx'

/** Tabela-resumo no formato do relatório: Nome | Qt. / Total R$ | % | variação vs fechamento anterior. */
export function GroupTable({ label, rows, measure, limit = 12 }: { label: string; rows: MergedGroup[]; measure: 'valor' | 'qt' | 'ambos'; limit?: number }) {
  const [all, setAll] = useState(false)
  const hasPrev = rows.some((r) => r.qtPrev !== null)
  const totQt = rows.reduce((s, r) => s + r.qt, 0)
  const totVal = rows.reduce((s, r) => s + r.total, 0)
  const totQtPrev = rows.reduce((s, r) => s + (r.qtPrev ?? 0), 0)
  const totValPrev = rows.reduce((s, r) => s + (r.totalPrev ?? 0), 0)
  const byValue = measure !== 'qt'
  const shown = all ? rows : rows.slice(0, limit)
  const maxShare = Math.max(...rows.map((r) => Math.abs(byValue ? r.total / (totVal || 1) : r.qt / (totQt || 1))), 0.0001)

  const deltaCell = (r: { qt: number; total: number; qtPrev: number | null; totalPrev: number | null }) => {
    if (r.qtPrev === null) return null
    const dq = r.qt - r.qtPrev
    const dv = r.total - (r.totalPrev ?? 0)
    if (measure === 'qt') return <Delta value={dq} text={fmtSigned(dq)} invert />
    if (measure === 'valor') return <Delta value={dv} text={fmtSignedBRL(dv)} invert />
    return (
      <>
        <Delta value={dv} text={fmtSignedBRL(dv)} invert />
        <div className="small muted">{fmtSigned(dq)} pedidos</div>
      </>
    )
  }

  return (
    <div className="table-wrap" style={{ maxHeight: 'none' }}>
      <table>
        <thead>
          <tr>
            <th>{label}</th>
            {measure !== 'valor' && <th className="num">Qt.</th>}
            {measure !== 'qt' && <th className="num">Total - R$</th>}
            <th className="num" style={{ width: 150 }}>%</th>
            {hasPrev && <th className="num">Vs. anterior</th>}
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => {
            const share = byValue ? r.total / (totVal || 1) : r.qt / (totQt || 1)
            return (
              <tr key={r.name} className={r.qt === 0 ? 'muted' : ''}>
                <td>{r.name}</td>
                {measure !== 'valor' && <td className="num">{fmt(r.qt)}</td>}
                {measure !== 'qt' && <td className="num">{fmtBRL(r.total)}</td>}
                <td className="num">
                  <div className="share">
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${Math.max(0, (share / maxShare) * 100)}%` }} />
                    </div>
                    <span>{fmtPct(share)}</span>
                  </div>
                </td>
                {hasPrev && <td className="num">{deltaCell(r)}</td>}
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            {measure !== 'valor' && <td className="num">{fmt(totQt)}</td>}
            {measure !== 'qt' && <td className="num">{fmtBRL(totVal)}</td>}
            <td className="num">100%</td>
            {hasPrev && <td className="num">{deltaCell({ qt: totQt, total: totVal, qtPrev: totQtPrev, totalPrev: totValPrev })}</td>}
          </tr>
        </tfoot>
      </table>
      {rows.length > limit && (
        <button className="btn ghost small table-more" onClick={() => setAll(!all)}>
          {all ? 'Mostrar menos' : `Mostrar todos (${rows.length})`}
        </button>
      )}
    </div>
  )
}
