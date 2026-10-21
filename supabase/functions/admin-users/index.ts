// Gerencia contas de acesso. Só administradores (tabela app_users) podem chamar.
// Ações: create {email, password, role, nome} | reset {email, password} | remove {email}
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: caller } = await admin.auth.getUser(token)
  const callerEmail = caller.user?.email?.toLowerCase()
  if (!callerEmail) return json({ error: 'Sessão inválida' }, 401)
  const { data: me } = await admin.from('app_users').select('role').eq('email', callerEmail).maybeSingle()
  if (me?.role !== 'admin') return json({ error: 'Apenas administradores podem gerenciar usuários' }, 403)

  let body: { action?: string; email?: string; password?: string; role?: string; nome?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Corpo inválido' }, 400)
  }
  const email = (body.email ?? '').trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'E-mail inválido' }, 400)

  const findUser = async () => {
    for (let page = 1; page < 50; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
      if (error) throw error
      const u = data.users.find((x) => x.email?.toLowerCase() === email)
      if (u || data.users.length < 200) return u ?? null
    }
    return null
  }

  try {
    if (body.action === 'create') {
      const role = body.role ?? 'leitor'
      if (!['admin', 'editor', 'leitor'].includes(role)) return json({ error: 'Perfil inválido' }, 400)
      if (!body.password || body.password.length < 8) return json({ error: 'A senha temporária precisa ter ao menos 8 caracteres' }, 400)
      const existing = await findUser()
      if (existing) {
        const { error } = await admin.auth.admin.updateUserById(existing.id, { password: body.password, email_confirm: true })
        if (error) throw error
      } else {
        const { error } = await admin.auth.admin.createUser({ email, password: body.password, email_confirm: true })
        if (error) throw error
      }
      const { error } = await admin
        .from('app_users')
        .upsert({ email, role, nome: body.nome ?? null, must_change_password: true }, { onConflict: 'email' })
      if (error) throw error
      return json({ ok: true })
    }

    if (body.action === 'reset') {
      if (!body.password || body.password.length < 8) return json({ error: 'A senha temporária precisa ter ao menos 8 caracteres' }, 400)
      const u = await findUser()
      if (!u) return json({ error: 'Usuário não encontrado' }, 404)
      const { error } = await admin.auth.admin.updateUserById(u.id, { password: body.password })
      if (error) throw error
      await admin.from('app_users').update({ must_change_password: true }).eq('email', email)
      return json({ ok: true })
    }

    if (body.action === 'remove') {
      if (email === callerEmail) return json({ error: 'Você não pode remover o próprio acesso' }, 400)
      await admin.from('app_users').delete().eq('email', email)
      const u = await findUser()
      if (u) await admin.auth.admin.deleteUser(u.id)
      return json({ ok: true })
    }

    return json({ error: 'Ação desconhecida' }, 400)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Erro inesperado' }, 500)
  }
})
