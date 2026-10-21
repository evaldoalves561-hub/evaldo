import { useState } from 'react'
import { supabase } from '../lib/supabase.ts'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'entrar' | 'criar'>('entrar')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMsg('')
    const res =
      mode === 'entrar'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.href } })
    setBusy(false)
    if (res.error) setError(res.error.message)
    else if (mode === 'criar' && !res.data.session) setMsg('Conta criada. Confirme pelo link enviado ao seu e-mail e depois entre.')
  }

  return (
    <div className="login">
      <form className="card" onSubmit={submit}>
        <div className="brand" style={{ padding: 0 }}>
          <div className="brand-mark">⇄</div>
          Comparador de Tabelas
        </div>
        <p className="muted" style={{ margin: 0 }}>{mode === 'entrar' ? 'Entre para ver suas tabelas.' : 'Crie sua conta para começar.'}</p>
        <label className="field">
          E-mail
          <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          Senha
          <input className="input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <div className="error">{error}</div>}
        {msg && <div className="notice">{msg}</div>}
        <button className="btn primary" disabled={busy} style={{ justifyContent: 'center' }}>
          {busy ? 'Aguarde…' : mode === 'entrar' ? 'Entrar' : 'Criar conta'}
        </button>
        <button type="button" className="btn ghost" onClick={() => setMode(mode === 'entrar' ? 'criar' : 'entrar')} style={{ justifyContent: 'center' }}>
          {mode === 'entrar' ? 'Não tem conta? Criar conta' : 'Já tenho conta'}
        </button>
      </form>
    </div>
  )
}
