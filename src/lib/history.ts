import type { DatasetVersion } from './types.ts'
import { compareVersions, detectNumericColumns, type Comparison } from './diff.ts'
import { toNumber, sameValue } from './values.ts'
import type { Cell } from './types.ts'

export interface HistoryPoint {
  versionId: string
  label: string
  date: string
  rows: number
  added: number
  removed: number
  modified: number
  cellChanges: number
  sums: Record<string, number>
}

export interface History {
  points: HistoryPoint[]
  numericColumns: string[]
  steps: Comparison[]
  columnVolatility: { column: string; changes: number; versionsChanged: number }[]
  totals: { added: number; removed: number; modified: number; cellChanges: number }
}

export function sortVersions(versions: DatasetVersion[]): DatasetVersion[] {
  return [...versions].sort((a, b) => a.reference_date.localeCompare(b.reference_date) || a.created_at.localeCompare(b.created_at))
}

/** Resume a evolução de todas as versões, em ordem cronológica. */
export function buildHistory(versions: DatasetVersion[], keyColumn: string | null): History {
  const sorted = sortVersions(versions)
  const latest = sorted[sorted.length - 1]
  const numericColumns = latest ? detectNumericColumns(latest.columns, latest.rows.slice(0, 3000), keyColumn) : []
  const steps: Comparison[] = []
  const vol = new Map<string, { changes: number; versionsChanged: number }>()

  const points = sorted.map((v, i) => {
    const sums: Record<string, number> = {}
    for (const col of numericColumns) {
      let s = 0
      for (const r of v.rows) s += toNumber(r[col]) ?? 0
      sums[col] = s
    }
    let added = 0
    let removed = 0
    let modified = 0
    let cellChanges = 0
    if (i > 0) {
      const cmp = compareVersions(sorted[i - 1], v, keyColumn)
      steps.push(cmp)
      added = cmp.added.length
      removed = cmp.removed.length
      modified = cmp.modified.length
      cellChanges = cmp.cellChanges.length
      for (const s of cmp.columnStats) {
        if (!s.changed) continue
        const cur = vol.get(s.column) ?? { changes: 0, versionsChanged: 0 }
        cur.changes += s.changed
        cur.versionsChanged++
        vol.set(s.column, cur)
      }
    }
    return { versionId: v.id, label: v.label, date: v.reference_date, rows: v.rows.length, added, removed, modified, cellChanges, sums }
  })

  const totals = points.reduce(
    (t, p) => ({ added: t.added + p.added, removed: t.removed + p.removed, modified: t.modified + p.modified, cellChanges: t.cellChanges + p.cellChanges }),
    { added: 0, removed: 0, modified: 0, cellChanges: 0 },
  )
  const columnVolatility = [...vol.entries()].map(([column, v]) => ({ column, ...v })).sort((a, b) => b.changes - a.changes)
  return { points, numericColumns, steps, columnVolatility, totals }
}

export interface RecordTrail {
  columns: string[]
  entries: { label: string; date: string; present: boolean; values: Record<string, Cell>; changed: Set<string> }[]
}

/** Acompanha um registro (pela chave) em todas as versões. */
export function trackRecord(versions: DatasetVersion[], keyColumn: string, keyValue: string): RecordTrail {
  const sorted = sortVersions(versions)
  const columns = [...new Set(sorted.flatMap((v) => v.columns))].filter((c) => c !== keyColumn)
  let prev: Record<string, Cell> | null = null
  const entries = sorted.map((v) => {
    const row = v.rows.find((r) => String(r[keyColumn] ?? '').trim() === keyValue.trim())
    const values: Record<string, Cell> = row ?? {}
    const changed = new Set<string>()
    if (row && prev) for (const c of columns) if (!sameValue(prev[c] ?? null, row[c] ?? null)) changed.add(c)
    if (row) prev = row
    return { label: v.label, date: v.reference_date, present: Boolean(row), values, changed }
  })
  return { columns, entries }
}
