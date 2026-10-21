import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Dataset } from './lib/types.ts'
import { store } from './lib/store.ts'
import { supabase, supabaseConfigured } from './lib/supabase.ts'
import { sampleVersions } from './lib/sample.ts'
import { DatasetView } from './components/DatasetView.tsx'
import { Login } from './components/Login.tsx'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
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

  if (!ready) return null
  if (supabaseConfigured && !session) return <Login />
  return <Workspace email={session?.user.email ?? null} />
}

function Workspace({ email }: { email: string | null }) {
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  async function reload(selectId?: string) {
    try {
      const list = await store.listDatasets()
      setDatasets(list)
      setSelected((cur) => selectId ?? (cur && list.some((d) => d.id === cur) ? cur : (list[0]?.id ?? null)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar tabelas.')
    }
  }
  useEffect(() => {
    reload()
  }, [])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const d = await store.createDataset(name.trim(), null)
    setName('')
    setCreating(false)
    reload(d.id)
  }

  async function loadDemo() {
    const d = await store.createDataset('Estoque de produtos (exemplo)', 'Dados fictícios para conhecer o app')
    for (const v of sampleVersions()) {
      await store.addVersion({ dataset_id: d.id, label: v.label, reference_date: v.date, file_name: 'exemplo.csv', columns: v.columns, rows: v.rows })
    }
    await store.updateDataset(d.id, { key_column: 'Código' })
    reload(d.id)
  }

  const current = datasets.find((d) => d.id === selected) ?? null

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">⇄</div>
          Comparador de Tabelas
        </div>
        <div className="side-label">Minhas tabelas</div>
        <nav className="side-list">
          {datasets.map((d) => (
            <button key={d.id} className={`side-item ${d.id === selected ? 'active' : ''}`} onClick={() => setSelected(d.id)}>
              <span>{d.name}</span>
            </button>
          ))}
          {datasets.length === 0 && <span className="muted small" style={{ padding: '0 6px' }}>Nenhuma tabela ainda.</span>}
        </nav>
        {creating ? (
          <form onSubmit={create} className="field">
            <input className="input" autoFocus placeholder="Nome da tabela" value={name} onChange={(e) => setName(e.target.value)} />
            <div className="toolbar">
              <button className="btn primary">Criar</button>
              <button type="button" className="btn ghost" onClick={() => setCreating(false)}>
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <button className="btn primary" onClick={() => setCreating(true)} style={{ justifyContent: 'center' }}>
            + Nova tabela
          </button>
        )}
        <div className="side-foot">
          {!supabaseConfigured && <div className="notice small">Modo demonstração: os dados ficam só neste navegador. Configure o Supabase para salvar na nuvem.</div>}
          {email && (
            <>
              <span className="muted">{email}</span>
              <button className="btn" onClick={() => supabase.auth.signOut()}>
                Sair
              </button>
            </>
          )}
        </div>
      </aside>
      <main className="main">
        {error && <div className="error">{error}</div>}
        {current ? (
          <DatasetView
            key={current.id}
            dataset={current}
            onChanged={(d) => setDatasets((list) => list.map((x) => (x.id === d.id ? d : x)))}
            onDeleted={() => {
              setSelected(null)
              reload()
            }}
          />
        ) : (
          <div className="card empty">
            <h2>Compare versões das suas tabelas</h2>
            <p>Crie uma tabela e envie arquivos CSV ou Excel ao longo do tempo. O app mostra gráficos e resumos de tudo que mudou.</p>
            <div className="toolbar" style={{ justifyContent: 'center', marginTop: 16 }}>
              <button className="btn primary" onClick={() => setCreating(true)}>
                + Nova tabela
              </button>
              <button className="btn" onClick={loadDemo}>
                Carregar exemplo
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
