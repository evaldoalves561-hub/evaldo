import { useState } from 'react'
import { supabase } from '../lib/supabase.ts'
import { changePassword } from '../lib/store.ts'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setError(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message)
  }

  return (
    <div className="login">
      <form className="card" onSubmit={submit}>
        <Brand />
        <p className="muted" style={{ margin: 0 }}>Acesso restrito. Entre com o e-mail e a senha que o administrador enviou para você.</p>
        <label className="field">
          E-mail
          <input className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          Senha
          <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <div className="error">{error}</div>}
        <button className="btn primary" disabled={busy} style={{ justifyContent: 'center' }}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="muted small" style={{ margin: 0 }}>Esqueceu a senha? Peça ao administrador uma nova senha temporária.</p>
      </form>
    </div>
  )
}

export function ChangePassword({ first, onDone }: { first: boolean; onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) return setError('A senha precisa ter ao menos 8 caracteres.')
    if (password !== confirm) return setError('As senhas não conferem.')
    setBusy(true)
    setError('')
    try {
      await changePassword(password)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao trocar a senha.')
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <form className="card" onSubmit={submit}>
        <Brand />
        <p className="muted" style={{ margin: 0 }}>{first ? 'Primeiro acesso: crie a sua senha para continuar.' : 'Escolha uma nova senha.'}</p>
        <label className="field">
          Nova senha
          <input className="input" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label className="field">
          Repita a nova senha
          <input className="input" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        {error && <div className="error">{error}</div>}
        <button className="btn primary" disabled={busy} style={{ justifyContent: 'center' }}>
          {busy ? 'Salvando…' : 'Salvar senha'}
        </button>
        {!first && (
          <button type="button" className="btn ghost" onClick={onDone} style={{ justifyContent: 'center' }}>
            Cancelar
          </button>
        )}
      </form>
    </div>
  )
}

export function NoAccess({ email }: { email: string }) {
  return (
    <div className="login">
      <div className="card">
        <Brand />
        <p style={{ margin: 0 }}>
          A conta <b>{email}</b> não tem acesso a este relatório. Peça ao administrador para liberar o seu e-mail.
        </p>
        <button className="btn" onClick={() => supabase.auth.signOut()} style={{ justifyContent: 'center' }}>
          Sair
        </button>
      </div>
    </div>
  )
}

export function Brand() {
  return (
    <div className="brand" style={{ padding: 0 }}>
      <div className="brand-mark">⇄</div>
      Relatório de Fechamento
    </div>
  )
}
