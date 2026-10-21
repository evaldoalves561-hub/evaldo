export type Cell = string | number | boolean | null
export type Row = Record<string, Cell>

export interface Dataset {
  id: string
  name: string
  description: string | null
  key_column: string | null
  created_at: string
}

export interface DatasetVersion {
  id: string
  dataset_id: string
  label: string
  reference_date: string
  file_name: string | null
  columns: string[]
  rows: Row[]
  row_count: number
  created_at: string
}

export interface ParsedTable {
  columns: string[]
  rows: Row[]
}
