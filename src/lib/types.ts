export type Cell = string | number | boolean | null
export type Row = Record<string, Cell>

export interface ParsedTable {
  columns: string[]
  rows: Row[]
}

export type BaseId = 'alteracoes' | 'info_uau' | 'acomp_entregas'

export interface Fechamento {
  id: string
  label: string
  reference_date: string
  file_name: string | null
  created_by: string | null
  created_at: string
  descricao?: string | null
  updated_at?: string | null
  deleted_at?: string | null
  deleted_by?: string | null
}

export interface Anotacao {
  id: string
  fechamento_id: string | null
  base: BaseId | null
  chave: string | null
  texto: string
  autor: string
  created_at: string
  updated_at: string | null
  deleted_at: string | null
}

export interface HistoricoItem {
  id: number
  tabela: string
  registro_id: string
  acao: 'criado' | 'editado' | 'enviado_lixeira' | 'restaurado' | 'excluido_definitivo'
  antes: Record<string, unknown> | null
  depois: Record<string, unknown> | null
  autor: string | null
  created_at: string
}

export type Bases = Partial<Record<BaseId, ParsedTable>>

export type Role = 'admin' | 'editor' | 'leitor'

export interface AppUser {
  email: string
  role: Role
  nome: string | null
  must_change_password: boolean
  created_at: string
}
