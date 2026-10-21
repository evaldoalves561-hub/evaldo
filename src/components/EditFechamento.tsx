import { useEffect, useState } from 'react'
import type { Fechamento, HistoricoItem } from '../lib/types.ts'
import { store } from '../lib/store.ts'
import { fmtDate } from '../lib/format.ts'
import { Card } from './ui.tsx'

const CAMPOS: Record<string, string> = { label: 'Nome', reference_date: 'Data de referência', descricao: 'Descrição' }
const ACOES: Record<HistoricoItem['acao'], string> = {
  criado: 'enviou o fechamento',
  editado: 'editou',
  enviado_lixeira: 'moveu para a lixeira',
  restaurado: 'restaurou da lixeira',
  excluido_definitivo: 'excluiu definitivamente',
}
const show = (k: string, v: unknown) => (v === null || v === undefined || v === '' ? '(vazio)' : k === 'reference_date' ? fmtDate(String(v)) : String(v))

export function EditFechamento({ f, onSaved, onClose }: { f: Fechamento; onSaved: () => Promise<void>; onClose: () => void }) {
  const [label, setLabel] = useState(f.label)
  const [date, setDate] = useState(f.reference_date)
  const [descricao, setDescricao] = useState(f.descricao ?? '')
  const [hist, setHist] = useState<HistoricoItem[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)

  const loadHist = () => store.listHistorico(f.id).then(setHist).catch(() => setHist([]))
  useEffect(() => {
    loadHist()
  }, [f.id])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!label.trim()) return setError('O nome não pode ficar vazio.')
    setBusy(true)
    setError('')
    setOk(false)
    try {
      await store.updateFechamento(f.id, { label: label.trim(), reference_date: date, descricao: descricao.trim() || null })
      await onSaved()
      await loadHist()
      setOk(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid two">
      <Card title="Editar fechamento" subtitle="As bases da planilha não são alteradas. Toda edição fica registrada no histórico ao lado.">
        <form className="form-grid" onSubmit={save}>
          <label className="field">
            Nome
            <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} />
          </label>
          <label className="field">
            Data de referência
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field full">
            Descrição (opcional)
            <textarea className="input" rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: considera a data de geração de 14/09 até 19/10 às 10h" />
          </label>
          <div className="toolbar full" style={{ justifyContent: 'flex-end' }}>
            {ok && <span className="small" style={{ color: 'var(--good-text)' }}>Alterações salvas.</span>}
            <button type="button" className="btn ghost" onClick={onClose}>
              Voltar
            </button>
            <button className="btn primary" disabled={busy}>
              {busy ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </div>
        </form>
        {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
      </Card>
      <Card title="Histórico de alterações" subtitle="Quem mudou o quê, com o valor anterior">
        {hist.length === 0 ? (
          <p className="muted small">Nenhum registro ainda.</p>
        ) : (
          <ul className="hist">
            {hist.map((h) => {
              const changes =
                h.acao === 'editado' && h.antes && h.depois
                  ? Object.keys(CAMPOS).filter((k) => (h.antes![k] ?? null) !== (h.depois![k] ?? null))
                  : []
              if (h.acao === 'editado' && changes.length === 0) return null
              return (
                <li key={h.id}>
                  <div className="muted">
                    {new Date(h.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · {h.autor ?? 'sistema'}
                  </div>
                  <div>
                    {ACOES[h.acao]}
                    {changes.map((k) => (
                      <div key={k} className="small">
                        {CAMPOS[k]}: <span className="before">{show(k, h.antes![k])}</span> → <b>{show(k, h.depois![k])}</b>
                      </div>
                    ))}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}

export function Lixeira({ items, isAdmin, onRestore, onDelete }: { items: Fechamento[]; isAdmin: boolean; onRestore: (f: Fechamento) => void; onDelete: (f: Fechamento) => void }) {
  return (
    <Card title="Lixeira" subtitle="Fechamentos excluídos ficam aqui com todos os dados e podem ser restaurados a qualquer momento.">
      {items.length === 0 ? (
        <p className="muted">A lixeira está vazia.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fechamento</th>
                <th>Referência</th>
                <th>Excluído em</th>
                <th>Por</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((f) => (
                <tr key={f.id}>
                  <td><b>{f.label}</b></td>
                  <td>{fmtDate(f.reference_date)}</td>
                  <td className="small">{f.deleted_at ? new Date(f.deleted_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''}</td>
                  <td className="small muted">{f.deleted_by ?? '—'}</td>
                  <td>
                    <div className="toolbar">
                      <button className="btn small" onClick={() => onRestore(f)}>
                        Restaurar
                      </button>
                      {isAdmin && (
                        <button className="btn ghost small danger" onClick={() => onDelete(f)}>
                          Excluir definitivamente
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
