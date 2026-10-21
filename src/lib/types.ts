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
