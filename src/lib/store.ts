import { supabase, supabaseConfigured } from './supabase.ts'
import type { Anotacao, AppUser, BaseId, Bases, Fechamento, HistoricoItem, ParsedTable, Role } from './types.ts'

export interface Store {
  mode: 'supabase' | 'local'
  listFechamentos(): Promise<Fechamento[]>
  loadBases(ids: string[]): Promise<Record<string, Bases>>
  createFechamento(meta: { label: string; reference_date: string; file_name: string | null }, bases: Bases): Promise<Fechamento>
  updateFechamento(id: string, patch: { label?: string; reference_date?: string; descricao?: string | null }): Promise<void>
  /** Envia para a lixeira (pode ser restaurado) */
  trashFechamento(id: string, by: string | null): Promise<void>
  restoreFechamento(id: string): Promise<void>
  /** Exclusão definitiva (só administrador) */
  deleteFechamento(id: string): Promise<void>
  listAnotacoes(): Promise<Anotacao[]>
  addAnotacao(a: { fechamento_id: string | null; base: BaseId | null; chave: string | null; texto: string }, autor: string | null): Promise<void>
  updateAnotacao(id: string, texto: string): Promise<void>
  removeAnotacao(id: string): Promise<void>
  listHistorico(registroId: string): Promise<HistoricoItem[]>
}

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

const supabaseStore: Store = {
  mode: 'supabase',
  async listFechamentos() {
    return check(await supabase.from('fechamentos').select('*').order('reference_date').order('created_at'))
  },
  async loadBases(ids) {
    const out: Record<string, Bases> = {}
    if (!ids.length) return out
    // Busca em partes para não estourar o tamanho da resposta
    for (let i = 0; i < ids.length; i += 4) {
      const chunk = ids.slice(i, i + 4)
      const data = check(await supabase.from('fechamento_bases').select('fechamento_id, base, columns, rows').in('fechamento_id', chunk))
      for (const b of data as { fechamento_id: string; base: BaseId; columns: string[]; rows: ParsedTable['rows'] }[]) {
        ;(out[b.fechamento_id] ??= {})[b.base] = { columns: b.columns, rows: b.rows }
      }
    }
    return out
  },
  async createFechamento(meta, bases) {
    const f = check(await supabase.from('fechamentos').insert(meta).select().single()) as Fechamento
    try {
      for (const [base, t] of Object.entries(bases)) {
        check(await supabase.from('fechamento_bases').insert({ fechamento_id: f.id, base, columns: t.columns, rows: t.rows, row_count: t.rows.length }))
      }
    } catch (e) {
      await supabase.from('fechamentos').delete().eq('id', f.id)
      throw e
    }
    return f
  },
  async updateFechamento(id, patch) {
    check(await supabase.from('fechamentos').update(patch).eq('id', id))
  },
  async trashFechamento(id, by) {
    check(await supabase.from('fechamentos').update({ deleted_at: new Date().toISOString(), deleted_by: by }).eq('id', id))
  },
  async restoreFechamento(id) {
    check(await supabase.from('fechamentos').update({ deleted_at: null, deleted_by: null }).eq('id', id))
  },
  async deleteFechamento(id) {
    check(await supabase.from('fechamentos').delete().eq('id', id))
  },
  async listAnotacoes() {
    return check(await supabase.from('anotacoes').select('*').is('deleted_at', null).order('created_at', { ascending: false })) as Anotacao[]
  },
  async addAnotacao(a) {
    check(await supabase.from('anotacoes').insert(a))
  },
  async updateAnotacao(id, texto) {
    check(await supabase.from('anotacoes').update({ texto }).eq('id', id))
  },
  async removeAnotacao(id) {
    check(await supabase.from('anotacoes').update({ deleted_at: new Date().toISOString() }).eq('id', id))
  },
  async listHistorico(registroId) {
    return check(await supabase.from('historico').select('*').eq('registro_id', registroId).order('created_at', { ascending: false })) as HistoricoItem[]
  },
}

// Modo demonstração (sem Supabase): os dados ficam só na memória desta aba.
const mem: { list: Fechamento[]; bases: Record<string, Bases>; notes: Anotacao[]; hist: HistoricoItem[] } = { list: [], bases: {}, notes: [], hist: [] }
const now = () => new Date().toISOString()
function logLocal(tabela: string, registro_id: string, acao: HistoricoItem['acao'], antes: object | null, depois: object | null) {
  mem.hist.unshift({ id: mem.hist.length + 1, tabela, registro_id, acao, antes: antes && { ...antes }, depois: depois && { ...depois }, autor: null, created_at: now() })
}
const localStore: Store = {
  mode: 'local',
  async listFechamentos() {
    return [...mem.list].sort((a, b) => a.reference_date.localeCompare(b.reference_date) || a.created_at.localeCompare(b.created_at))
  },
  async loadBases(ids) {
    return Object.fromEntries(ids.map((id) => [id, mem.bases[id] ?? {}]))
  },
  async createFechamento(meta, bases) {
    const f: Fechamento = { ...meta, id: crypto.randomUUID(), created_by: null, created_at: new Date().toISOString() }
    mem.list.push(f)
    mem.bases[f.id] = bases
    logLocal('fechamentos', f.id, 'criado', null, f)
    return f
  },
  async updateFechamento(id, patch) {
    const f = mem.list.find((x) => x.id === id)
    if (!f) return
    const antes = { ...f }
    Object.assign(f, patch, { updated_at: now() })
    logLocal('fechamentos', id, 'editado', antes, f)
  },
  async trashFechamento(id, by) {
    const f = mem.list.find((x) => x.id === id)
    if (!f) return
    const antes = { ...f }
    Object.assign(f, { deleted_at: now(), deleted_by: by })
    logLocal('fechamentos', id, 'enviado_lixeira', antes, f)
  },
  async restoreFechamento(id) {
    const f = mem.list.find((x) => x.id === id)
    if (!f) return
    const antes = { ...f }
    Object.assign(f, { deleted_at: null, deleted_by: null })
    logLocal('fechamentos', id, 'restaurado', antes, f)
  },
  async deleteFechamento(id) {
    mem.list = mem.list.filter((f) => f.id !== id)
    delete mem.bases[id]
  },
  async listAnotacoes() {
    return mem.notes.filter((n) => !n.deleted_at)
  },
  async addAnotacao(a, autor) {
    mem.notes.unshift({ ...a, id: crypto.randomUUID(), autor: autor ?? 'demonstração', created_at: now(), updated_at: null, deleted_at: null })
  },
  async updateAnotacao(id, texto) {
    const n = mem.notes.find((x) => x.id === id)
    if (n) Object.assign(n, { texto, updated_at: now() })
  },
  async removeAnotacao(id) {
    const n = mem.notes.find((x) => x.id === id)
    if (n) n.deleted_at = now()
  },
  async listHistorico(registroId) {
    return mem.hist.filter((h) => h.registro_id === registroId)
  },
}

export const store: Store = supabaseConfigured ? supabaseStore : localStore

// ---- Acesso ----

export async function myAccess(email: string): Promise<AppUser | null> {
  const res = await supabase.from('app_users').select('*').eq('email', email.toLowerCase()).maybeSingle()
  if (res.error) throw new Error(res.error.message)
  return res.data as AppUser | null
}

export async function listUsers(): Promise<AppUser[]> {
  return check(await supabase.from('app_users').select('*').order('created_at')) as AppUser[]
}

export async function setUserRole(email: string, role: Role, nome: string | null) {
  check(await supabase.from('app_users').update({ role, nome }).eq('email', email))
}

export async function adminUsers(body: { action: 'create' | 'reset' | 'remove'; email: string; password?: string; role?: Role; nome?: string }) {
  const { data, error } = await supabase.functions.invoke('admin-users', { body })
  if (error) {
    let msg = error.message
    try {
      const ctx = (error as { context?: Response }).context
      if (ctx) msg = ((await ctx.json()) as { error?: string }).error ?? msg
    } catch {
      // mantém a mensagem original
    }
    throw new Error(msg)
  }
  if (data?.error) throw new Error(data.error)
}

export async function changePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw new Error(error.message)
  const r = await supabase.rpc('mark_password_changed')
  if (r.error) throw new Error(r.error.message)
}
