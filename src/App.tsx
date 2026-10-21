import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Anotacao, AppUser, Bases, Fechamento, Role } from './lib/types.ts'
import { myAccess, store } from './lib/store.ts'
import { supabase, supabaseConfigured } from './lib/supabase.ts'
import { fmtDate } from './lib/format.ts'
import { ChangePassword, Login, NoAccess } from './components/Login.tsx'
import { ResumoView } from './components/ResumoView.tsx'
import { EvolucaoView } from './components/EvolucaoView.tsx'
import { RegistrosView } from './components/RegistrosView.tsx'
import { BasesView } from './components/BasesView.tsx'
import { UsersView } from './components/UsersView.tsx'
import { UploadFechamento } from './components/UploadFechamento.tsx'
import { EditFechamento, Lixeira } from './components/EditFechamento.tsx'
import { NotesPage, NotesProvider, notesFor } from './components/Notes.tsx'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [access, setAccess] = useState<AppUser | null | undefined>(undefined)
  const [ready, setReady] = useState(!supabaseConfigured)

  useEffect(() => {
    if (!supabaseConfigured) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const email = session?.user.email ?? null
  const loadAccess = useCallback(() => {
    if (!email) return setAccess(undefined)
    myAccess(email)
      .then(setAccess)
      .catch(() => setAccess(null))
  }, [email])
  useEffect(loadAccess, [loadAccess])

  if (!ready) return null
  if (!supabaseConfigured) return <Workspace email={null} role="admin" />
  if (!session) return <Login />
  if (access === undefined) return null
  if (access === null) return <NoAccess email={email!} />
  if (access.must_change_password) return <ChangePassword first onDone={loadAccess} />
  return <Workspace email={email} role={access.role} />
}

type View = 'resumo' | 'evolucao' | 'registros' | 'bases' | 'anotacoes' | 'usuarios' | 'lixeira' | 'editar' | 'upload' | 'senha'

const NAV: { id: View; label: string; admin?: boolean }[] = [
  { id: 'resumo', label: 'Resumo do fechamento' },
  { id: 'evolucao', label: 'Evolução' },
  { id: 'registros', label: 'O que mudou (registros)' },
  { id: 'bases', label: 'Bases de dados' },
  { id: 'anotacoes', label: 'Anotações' },
  { id: 'usuarios', label: 'Usuários e acesso', admin: true },
]

function Workspace({ email, role }: { email: string | null; role: Role }) {
  const [all, setAll] = useState<Fechamento[] | null>(null)
  const [notes, setNotes] = useState<Anotacao[]>([])
  const [bases, setBases] = useState<Record<string, Bases>>({})
  const [selId, setSelId] = useState<string | null>(null)
  const [cmpId, setCmpId] = useState<string | null>(null)
  const [view, setView] = useState<View>('resumo')
  const [error, setError] = useState('')
  const canEdit = role === 'admin' || role === 'editor'

  const list = all ? all.filter((f) => !f.deleted_at) : null
  const trash = all ? all.filter((f) => f.deleted_at) : []

  const loadNotes = useCallback(async () => {
    try {
      setNotes(await store.listAnotacoes())
    } catch {
      setNotes([])
    }
  }, [])

  const reload = useCallback(async (select?: string) => {
    try {
      const everything = await store.listFechamentos()
      const l = everything.filter((f) => !f.deleted_at)
      const b = await store.loadBases(everything.map((f) => f.id))
      setAll(everything)
      setBases(b)
      const sel = select ?? l[l.length - 1]?.id ?? null
      setSelId(sel)
      const idx = l.findIndex((f) => f.id === sel)
      setCmpId(idx > 0 ? l[idx - 1].id : null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar os fechamentos.')
      setAll([])
    }
  }, [])
  useEffect(() => {
    reload()
    loadNotes()
  }, [reload, loadNotes])

  const cur = list?.find((f) => f.id === selId) ?? null
  const prev = list?.find((f) => f.id === cmpId && f.id !== selId) ?? null

  function select(id: string) {
    setSelId(id)
    const idx = list!.findIndex((f) => f.id === id)
    setCmpId(idx > 0 ? list![idx - 1].id : null)
    if (['upload', 'editar', 'lixeira', 'anotacoes', 'usuarios'].includes(view)) setView('resumo')
  }

  async function upload(b: Bases, label: string, date: string, fileName: string) {
    const f = await store.createFechamento({ label, reference_date: date, file_name: fileName }, b)
    await reload(f.id)
    setView('resumo')
  }

  async function remove() {
    if (!cur || !confirm(`Mover "${cur.label}" para a lixeira? Você pode restaurá-lo depois, sem perder nada.`)) return
    await store.trashFechamento(cur.id, email)
    reload()
  }
  async function restore(f: Fechamento) {
    await store.restoreFechamento(f.id)
    await reload(f.id)
    setView('resumo')
  }
  async function destroy(f: Fechamento) {
    if (!confirm(`Excluir "${f.label}" definitivamente? As bases desse fechamento serão apagadas e isso não pode ser desfeito.`)) return
    await store.deleteFechamento(f.id)
    reload(selId ?? undefined)
  }

  if (view === 'senha') return <ChangePasswordWrap onDone={() => setView('resumo')} />

  const roleLabel = role === 'admin' ? 'Administrador' : role === 'editor' ? 'Editor' : 'Leitor'

  return (
    <NotesProvider notes={notes} me={email} isAdmin={role === 'admin'} refresh={loadNotes}>
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">⇄</div>
          Relatório de Fechamento
        </div>
        <nav className="side-list">
          {NAV.filter((n) => !n.admin || (role === 'admin' && email)).map((n) => (
            <button key={n.id} className={`side-item ${view === n.id ? 'active' : ''}`} onClick={() => setView(n.id)}>
              {n.label}
            </button>
          ))}
          {canEdit && trash.length > 0 && (
            <button className={`side-item ${view === 'lixeira' ? 'active' : ''}`} onClick={() => setView('lixeira')}>
              Lixeira ({trash.length})
            </button>
          )}
        </nav>
        <div className="side-label">Fechamentos</div>
        <nav className="side-list" style={{ overflow: 'auto', maxHeight: 320 }}>
          {[...(list ?? [])].reverse().map((f) => (
            <button key={f.id} className={`side-item ${f.id === selId ? 'active' : ''}`} onClick={() => select(f.id)}>
              <span>
                {f.label}
                <small>{fmtDate(f.reference_date)}</small>
              </span>
            </button>
          ))}
          {list?.length === 0 && <span className="muted small" style={{ padding: '0 6px' }}>Nenhum fechamento enviado.</span>}
        </nav>
        {canEdit && (
          <button className="btn primary" onClick={() => setView('upload')} style={{ justifyContent: 'center' }}>
            + Enviar fechamento
          </button>
        )}
        <div className="side-foot">
          {!supabaseConfigured && <div className="notice small">Modo demonstração: os dados ficam só nesta aba do navegador.</div>}
          {email && (
            <>
              <div>
                <div className="role">{roleLabel}</div>
                <span className="muted">{email}</span>
              </div>
              <div className="toolbar">
                <button className="btn small" onClick={() => setView('senha')}>
                  Alterar senha
                </button>
                <button className="btn small" onClick={() => supabase.auth.signOut()}>
                  Sair
                </button>
              </div>
            </>
          )}
        </div>
      </aside>

      <main className="main">
        {error && <div className="error">{error}</div>}
        {list === null ? (
          <p className="muted">Carregando…</p>
        ) : view === 'usuarios' && email ? (
          <>
            <div className="page-head">
              <div>
                <div className="eyebrow">Administração</div>
                <h1>Usuários e acesso</h1>
              </div>
            </div>
            <UsersView me={email} />
          </>
        ) : view === 'lixeira' ? (
          <>
            <div className="page-head">
              <div>
                <div className="eyebrow">Fechamentos excluídos</div>
                <h1>Lixeira</h1>
              </div>
            </div>
            <Lixeira items={trash} isAdmin={role === 'admin'} onRestore={restore} onDelete={destroy} />
          </>
        ) : view === 'anotacoes' ? (
          <>
            <div className="page-head">
              <div>
                <div className="eyebrow">Anotações</div>
                <h1>Anotações</h1>
                <p className="muted" style={{ margin: '4px 0 0' }}>Anote no fechamento (no Resumo do fechamento) ou em cada registro (ícone ✎ nas tabelas "O que mudou" e "Bases de dados"). Anotações de um registro continuam aparecendo nos fechamentos seguintes.</p>
              </div>
            </div>
            <NotesPage fechamentos={all ?? []} onOpenFechamento={(id) => { select(id); setView('resumo') }} />
          </>
        ) : view === 'upload' ? (
          <UploadFechamento onSubmit={upload} onCancel={() => setView('resumo')} />
        ) : !cur ? (
          <div className="card empty">
            <h2>Nenhum fechamento ainda</h2>
            <p>{canEdit ? 'Envie a planilha "Alterações - Fechamento" para gerar o primeiro relatório.' : 'Assim que um fechamento for enviado, o relatório aparece aqui.'}</p>
            {canEdit && (
              <button className="btn primary" onClick={() => setView('upload')} style={{ marginTop: 12 }}>
                + Enviar fechamento
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="page-head">
              <div>
                <div className="eyebrow">{view === 'editar' ? 'Editar fechamento' : NAV.find((n) => n.id === view)?.label}</div>
                <h1>{view === 'evolucao' ? 'Evolução dos fechamentos' : cur.label}</h1>
                {view !== 'evolucao' && (
                  <p className="muted" style={{ margin: '4px 0 0' }}>
                    Referência {fmtDate(cur.reference_date)}
                    {cur.file_name ? ` · ${cur.file_name}` : ''}
                    {notesFor(notes, { fechamento_id: cur.id, base: null, chave: null }).length > 0 && ` · ${notesFor(notes, { fechamento_id: cur.id, base: null, chave: null }).length} anotação(ões)`}
                  </p>
                )}
                {view !== 'evolucao' && cur.descricao && <p style={{ margin: '6px 0 0', maxWidth: 760, whiteSpace: 'pre-wrap' }}>{cur.descricao}</p>}
              </div>
              {view !== 'evolucao' && (
                <div className="toolbar">
                  <label className="field">
                    Comparar com
                    <select className="select" value={prev?.id ?? ''} onChange={(e) => setCmpId(e.target.value || null)}>
                      <option value="">Nenhum</option>
                      {list
                        .filter((f) => f.id !== cur.id)
                        .map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.label} ({fmtDate(f.reference_date)})
                          </option>
                        ))}
                    </select>
                  </label>
                  <button className="btn" onClick={() => setView('resumo')} style={{ alignSelf: 'flex-end', display: view === 'editar' ? 'inline-flex' : 'none' }}>
                    Ver relatório
                  </button>
                  {canEdit && view !== 'editar' && (
                    <button className="btn" onClick={() => setView('editar')} style={{ alignSelf: 'flex-end' }}>
                      ✎ Editar
                    </button>
                  )}
                  {canEdit && (
                    <button className="btn ghost danger" onClick={remove} style={{ alignSelf: 'flex-end' }}>
                      Mover para lixeira
                    </button>
                  )}
                </div>
              )}
            </div>
            {view === 'editar' && <EditFechamento key={cur.id} f={cur} onSaved={() => reload(cur.id)} onClose={() => setView('resumo')} />}
            {view === 'resumo' && <ResumoView key={cur.id + (prev?.id ?? '')} cur={cur} curBases={bases[cur.id] ?? {}} prev={prev} prevBases={prev ? (bases[prev.id] ?? {}) : null} />}
            {view === 'evolucao' && <EvolucaoView items={list.map((f) => ({ f, bases: bases[f.id] ?? {} }))} />}
            {view === 'registros' && <RegistrosView cur={cur} curBases={bases[cur.id] ?? {}} prev={prev} prevBases={prev ? (bases[prev.id] ?? {}) : null} />}
            {view === 'bases' && <BasesView key={cur.id} cur={cur} bases={bases[cur.id] ?? {}} />}
          </>
        )}
      </main>
    </div>
    </NotesProvider>
  )
}

function ChangePasswordWrap({ onDone }: { onDone: () => void }) {
  return <ChangePassword first={false} onDone={onDone} />
}
