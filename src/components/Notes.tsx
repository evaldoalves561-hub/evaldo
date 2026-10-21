import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Anotacao, BaseId, Fechamento } from '../lib/types.ts'
import { store } from '../lib/store.ts'
import { BASE_BY_ID } from '../lib/fechamento.ts'

interface NotesCtx {
  notes: Anotacao[]
  me: string | null
  isAdmin: boolean
  refresh: () => Promise<void>
  open: (target: NoteTarget) => void
}
export interface NoteTarget {
  fechamento_id: string | null
  base: BaseId | null
  chave: string | null
  title: string
  subtitle?: string
}

const Ctx = createContext<NotesCtx | null>(null)
export const useNotes = () => useContext(Ctx)!

export function NotesProvider({ notes, me, isAdmin, refresh, children }: { notes: Anotacao[]; me: string | null; isAdmin: boolean; refresh: () => Promise<void>; children: ReactNode }) {
  const [target, setTarget] = useState<NoteTarget | null>(null)
  return (
    <Ctx.Provider value={{ notes, me, isAdmin, refresh, open: setTarget }}>
      {children}
      {target && (
        <div className="drawer-backdrop" onClick={() => setTarget(null)}>
          <aside className="drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Anotações">
            <div className="card-head">
              <div>
                <h2>{target.title}</h2>
                {target.subtitle && <p>{target.subtitle}</p>}
              </div>
              <button className="btn ghost" onClick={() => setTarget(null)} aria-label="Fechar">
                ✕
              </button>
            </div>
            <NotesPanel target={target} />
          </aside>
        </div>
      )}
    </Ctx.Provider>
  )
}

/** Anotações de um registro valem para a chave em qualquer fechamento; as do fechamento, só para ele. */
export function notesFor(notes: Anotacao[], t: { fechamento_id: string | null; base: BaseId | null; chave: string | null }) {
  return t.chave ? notes.filter((n) => n.base === t.base && n.chave === t.chave) : notes.filter((n) => !n.chave && n.fechamento_id === t.fechamento_id)
}

const when = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export function NotesPanel({ target, compact = false }: { target: Omit<NoteTarget, 'title'>; compact?: boolean }) {
  const { notes, me, isAdmin, refresh } = useNotes()
  const list = notesFor(notes, target)
  const [text, setText] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await fn()
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar a anotação.')
    } finally {
      setBusy(false)
    }
  }

  const canEdit = (n: Anotacao) => isAdmin || !me || n.autor === me

  return (
    <div className="notes">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!text.trim()) return
          run(async () => {
            await store.addAnotacao({ fechamento_id: target.fechamento_id, base: target.base, chave: target.chave, texto: text.trim() }, me)
            setText('')
          })
        }}
      >
        <textarea className="input" rows={compact ? 2 : 3} placeholder="Escreva uma anotação… (ex.: cobrado do fornecedor em 20/10, aguardando retorno)" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="toolbar" style={{ justifyContent: 'flex-end', marginTop: 6 }}>
          <button className="btn primary small" disabled={busy || !text.trim()}>
            Adicionar anotação
          </button>
        </div>
      </form>
      {error && <div className="error">{error}</div>}
      {list.length === 0 && <p className="muted small">Nenhuma anotação ainda.</p>}
      {list.map((n) => (
        <div key={n.id} className="note">
          <div className="note-meta">
            <b>{n.autor}</b> · {when(n.created_at)}
            {n.updated_at && <span title={`Editada em ${when(n.updated_at)}`}> · editada</span>}
            {target.chave && n.fechamento_id !== target.fechamento_id && <span> · feita em outro fechamento</span>}
          </div>
          {editing === n.id ? (
            <>
              <textarea className="input" rows={3} value={editText} onChange={(e) => setEditText(e.target.value)} />
              <div className="toolbar" style={{ justifyContent: 'flex-end', marginTop: 6 }}>
                <button className="btn ghost small" onClick={() => setEditing(null)}>
                  Cancelar
                </button>
                <button
                  className="btn primary small"
                  disabled={busy || !editText.trim()}
                  onClick={() =>
                    run(async () => {
                      await store.updateAnotacao(n.id, editText.trim())
                      setEditing(null)
                    })
                  }
                >
                  Salvar
                </button>
              </div>
            </>
          ) : (
            <p className="note-text">{n.texto}</p>
          )}
          {canEdit(n) && editing !== n.id && (
            <div className="note-actions">
              <button
                className="btn ghost small"
                onClick={() => {
                  setEditing(n.id)
                  setEditText(n.texto)
                }}
              >
                Editar
              </button>
              <button className="btn ghost small danger" disabled={busy} onClick={() => confirm('Apagar esta anotação?') && run(() => store.removeAnotacao(n.id))}>
                Apagar
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/** Botão pequeno para abrir as anotações de um registro, com a contagem. */
export function NoteButton({ fechamento_id, base, chave, label }: { fechamento_id: string; base: BaseId; chave: string; label?: string }) {
  const { notes, open } = useNotes()
  const n = notesFor(notes, { fechamento_id, base, chave }).length
  return (
    <button
      className={`note-btn ${n ? 'has' : ''}`}
      title={n ? `${n} anotação(ões)` : 'Adicionar anotação'}
      onClick={() => open({ fechamento_id, base, chave, title: label ?? 'Anotações do registro', subtitle: `${BASE_BY_ID[base].short} · ${chave}` })}
    >
      ✎{n ? ` ${n}` : ''}
    </button>
  )
}

/** Página com todas as anotações. */
export function NotesPage({ fechamentos, onOpenFechamento }: { fechamentos: Fechamento[]; onOpenFechamento: (id: string) => void }) {
  const { notes, open } = useNotes()
  const [q, setQ] = useState('')
  const [tipo, setTipo] = useState<'' | 'fechamento' | BaseId>('')
  const byId = new Map(fechamentos.map((f) => [f.id, f]))
  const list = notes.filter(
    (n) =>
      (!tipo || (tipo === 'fechamento' ? !n.chave : n.base === tipo)) &&
      (!q.trim() || `${n.texto} ${n.chave ?? ''} ${n.autor}`.toLowerCase().includes(q.trim().toLowerCase())),
  )
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>Todas as anotações</h2>
          <p>{list.length} anotações</p>
        </div>
        <div className="toolbar">
          <select className="select" value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} aria-label="Tipo">
            <option value="">Todas</option>
            <option value="fechamento">Sobre o fechamento</option>
            <option value="alteracoes">Valores arrastados</option>
            <option value="info_uau">Erros Info UAU</option>
            <option value="acomp_entregas">Entregas pendentes</option>
          </select>
          <input className="input" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Anotação</th>
              <th>Sobre</th>
              <th>Fechamento</th>
              <th>Autor</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            {list.map((n) => {
              const f = n.fechamento_id ? byId.get(n.fechamento_id) : null
              return (
                <tr key={n.id}>
                  <td style={{ whiteSpace: 'pre-wrap', maxWidth: 420 }}>{n.texto}</td>
                  <td className="small">
                    {n.chave ? (
                      <button className="link" onClick={() => open({ fechamento_id: n.fechamento_id, base: n.base, chave: n.chave, title: 'Anotações do registro', subtitle: `${BASE_BY_ID[n.base!].short} · ${n.chave}` })}>
                        {BASE_BY_ID[n.base!].short} · {n.chave}
                      </button>
                    ) : (
                      'Fechamento'
                    )}
                  </td>
                  <td className="small">{f ? <button className="link" onClick={() => onOpenFechamento(f.id)}>{f.label}</button> : '—'}</td>
                  <td className="small">{n.autor}</td>
                  <td className="small muted">{when(n.created_at)}</td>
                </tr>
              )
            })}
            {list.length === 0 && (
              <tr>
                <td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                  Nenhuma anotação encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
