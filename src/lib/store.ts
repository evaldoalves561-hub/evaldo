import { supabase, supabaseConfigured } from './supabase.ts'
import type { Dataset, DatasetVersion, Row } from './types.ts'

export interface NewVersion {
  dataset_id: string
  label: string
  reference_date: string
  file_name: string | null
  columns: string[]
  rows: Row[]
}

export interface Store {
  mode: 'supabase' | 'local'
  listDatasets(): Promise<Dataset[]>
  createDataset(name: string, description: string | null): Promise<Dataset>
  updateDataset(id: string, patch: Partial<Pick<Dataset, 'name' | 'description' | 'key_column'>>): Promise<void>
  deleteDataset(id: string): Promise<void>
  listVersions(datasetId: string): Promise<DatasetVersion[]>
  addVersion(v: NewVersion): Promise<DatasetVersion>
  deleteVersion(id: string): Promise<void>
}

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

export const supabaseStore: Store = {
  mode: 'supabase',
  async listDatasets() {
    return check(await supabase.from('datasets').select('*').order('created_at', { ascending: false }))
  },
  async createDataset(name, description) {
    return check(await supabase.from('datasets').insert({ name, description }).select().single())
  },
  async updateDataset(id, patch) {
    check(await supabase.from('datasets').update(patch).eq('id', id))
  },
  async deleteDataset(id) {
    check(await supabase.from('datasets').delete().eq('id', id))
  },
  async listVersions(datasetId) {
    return check(
      await supabase
        .from('dataset_versions')
        .select('*')
        .eq('dataset_id', datasetId)
        .order('reference_date', { ascending: true })
        .order('created_at', { ascending: true }),
    )
  },
  async addVersion(v) {
    return check(await supabase.from('dataset_versions').insert({ ...v, row_count: v.rows.length }).select().single())
  },
  async deleteVersion(id) {
    check(await supabase.from('dataset_versions').delete().eq('id', id))
  },
}

// Modo demonstração: guarda tudo no navegador quando o Supabase não está configurado.
const LS_KEY = 'comparador-demo-v1'
interface LocalDb {
  datasets: Dataset[]
  versions: DatasetVersion[]
}
function load(): LocalDb {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '') as LocalDb
  } catch {
    return { datasets: [], versions: [] }
  }
}
function save(db: LocalDb) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(db))
  } catch {
    // armazenamento cheio ou bloqueado: os dados ficam só na memória desta aba
  }
}
let memory: LocalDb | null = null
const db = () => (memory ??= load())

export const localStore: Store = {
  mode: 'local',
  async listDatasets() {
    return [...db().datasets].reverse()
  },
  async createDataset(name, description) {
    const d: Dataset = { id: crypto.randomUUID(), name, description, key_column: null, created_at: new Date().toISOString() }
    db().datasets.push(d)
    save(db())
    return d
  },
  async updateDataset(id, patch) {
    const d = db().datasets.find((x) => x.id === id)
    if (d) Object.assign(d, patch)
    save(db())
  },
  async deleteDataset(id) {
    const s = db()
    s.datasets = s.datasets.filter((d) => d.id !== id)
    s.versions = s.versions.filter((v) => v.dataset_id !== id)
    save(s)
  },
  async listVersions(datasetId) {
    return db().versions.filter((v) => v.dataset_id === datasetId)
  },
  async addVersion(v) {
    const nv: DatasetVersion = { ...v, id: crypto.randomUUID(), row_count: v.rows.length, created_at: new Date().toISOString() }
    db().versions.push(nv)
    save(db())
    return nv
  },
  async deleteVersion(id) {
    const s = db()
    s.versions = s.versions.filter((v) => v.id !== id)
    save(s)
  },
}

export const store: Store = supabaseConfigured ? supabaseStore : localStore
