import { useEffect, useState } from 'react'
import type { AppUser, Role } from '../lib/types.ts'
import { adminUsers, listUsers, setUserRole } from '../lib/store.ts'
import { Card } from './ui.tsx'

const ROLES: { id: Role; label: string; desc: string }[] = [
  { id: 'leitor', label: 'Leitor', desc: 'vê os relatórios' },
  { id: 'editor', label: 'Editor', desc: 'vê e envia fechamentos' },
  { id: 'admin', label: 'Administrador', desc: 'tudo, inclusive gerenciar usuários' },
]

function tempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const a = new Uint32Array(10)
  crypto.getRandomValues(a)
  return [...a].map((n) => chars[n % chars.length]).join('')
}

export function UsersView({ me }: { me: string }) {
  const [users, setUsers] = useState<AppUser[]>([])
  const [email, setEmail] = useState('')
  const [nome, setNome] = useState('')
  const [role, setRole] = useState<Role>('leitor')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null)

  const reload = () => listUsers().then(setUsers).catch((e) => setError(e.message))
  useEffect(() => {
    reload()
  }, [])

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await fn()
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado')
    } finally {
      setBusy(false)
    }
  }

  const create = (e: React.FormEvent) => {
    e.preventDefault()
    const password = tempPassword()
    const mail = email.trim().toLowerCase()
    run(async () => {
      await adminUsers({ action: 'create', email: mail, password, role, nome: nome.trim() || undefined })
      setCreated({ email: mail, password })
      setEmail('')
      setNome('')
    })
  }

  const link = window.location.origin + window.location.pathname

  return (
    <>
      <Card title="Dar acesso a uma pessoa" subtitle="O app gera uma senha temporária. Envie o link, o e-mail e a senha para a pessoa; no primeiro acesso ela cria a própria senha.">
        <form className="upload-grid" onSubmit={create} style={{ marginTop: 0 }}>
          <label className="field">
            E-mail
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            Nome (opcional)
            <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>
          <label className="field">
            Perfil
            <select className="select" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label} ({r.desc})
                </option>
              ))}
            </select>
          </label>
          <button className="btn primary" disabled={busy}>
            {busy ? 'Aguarde…' : 'Dar acesso'}
          </button>
        </form>
        {created && (
          <div className="notice" style={{ marginTop: 12 }}>
            Acesso criado. Envie para a pessoa: <b>{link}</b> · e-mail <b>{created.email}</b> · senha temporária <b>{created.password}</b>
            <button className="btn ghost small" onClick={() => navigator.clipboard?.writeText(`Acesso ao relatório de fechamento\nLink: ${link}\nE-mail: ${created.email}\nSenha temporária: ${created.password}`)}>
              Copiar
            </button>
          </div>
        )}
        {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
      </Card>

      <Card title="Quem tem acesso" subtitle={`${users.length} pessoas`}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>E-mail</th>
                <th>Nome</th>
                <th>Perfil</th>
                <th>Situação</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.email}>
                  <td>{u.email}</td>
                  <td>{u.nome ?? '—'}</td>
                  <td>
                    <select className="select" value={u.role} disabled={busy || u.email === me} onChange={(e) => run(() => setUserRole(u.email, e.target.value as Role, u.nome))}>
                      {ROLES.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="small muted">{u.must_change_password ? 'Ainda não trocou a senha temporária' : 'Ativo'}</td>
                  <td>
                    {u.email !== me && (
                      <div className="toolbar">
                        <button
                          className="btn ghost small"
                          disabled={busy}
                          onClick={() => {
                            const password = tempPassword()
                            run(async () => {
                              await adminUsers({ action: 'reset', email: u.email, password })
                              setCreated({ email: u.email, password })
                            })
                          }}
                        >
                          Nova senha
                        </button>
                        <button
                          className="btn ghost danger small"
                          disabled={busy}
                          onClick={() => confirm(`Remover o acesso de ${u.email}?`) && run(() => adminUsers({ action: 'remove', email: u.email }))}
                        >
                          Remover
                        </button>
                      </div>
                    )}
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
