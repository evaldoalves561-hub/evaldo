import type { Cell, Row } from './types.ts'
import { isEmpty, normalize, sameValue, toNumber } from './values.ts'
import { fmt, fmtCell, fmtSigned, fmtSignedPct, fmtPct } from './format.ts'

export interface CellChange {
  key: string
  column: string
  before: Cell
  after: Cell
  delta: number | null
  pct: number | null
}

export interface ModifiedRow {
  key: string
  before: Row
  after: Row
  changes: CellChange[]
}

export interface ColumnStat {
  column: string
  changed: number
  filled: number
  cleared: number
}

export interface NumericSummary {
  column: string
  sumBefore: number
  sumAfter: number
  avgBefore: number | null
  avgAfter: number | null
  delta: number
  pct: number | null
}

export type Tone = 'up' | 'down' | 'neutral' | 'warn'
export interface Insight {
  tone: Tone
  title: string
  detail: string
}

export interface Comparison {
  keyColumn: string | null
  totalBefore: number
  totalAfter: number
  added: { key: string; row: Row }[]
  removed: { key: string; row: Row }[]
  modified: ModifiedRow[]
  unchanged: number
  duplicateKeys: number
  columnsAdded: string[]
  columnsRemoved: string[]
  commonColumns: string[]
  columnStats: ColumnStat[]
  numeric: NumericSummary[]
  cellChanges: CellChange[]
  topMovers: CellChange[]
  insights: Insight[]
}

const KEY_HINTS = /^(id|cod|c[oó]d(igo)?|cpf|cnpj|matr[ií]cula|chave|sku|registro|n[uú]mero|num|ref)\b|(_id|\bid)$/i

/** Colunas em que pelo menos 80% dos valores preenchidos são números. */
export function detectNumericColumns(columns: string[], rows: Row[], exclude: string | null = null): string[] {
  return columns.filter((col) => {
    if (col === exclude) return false
    let filled = 0
    let numeric = 0
    for (const r of rows) {
      if (isEmpty(r[col])) continue
      filled++
      if (toNumber(r[col]) !== null) numeric++
    }
    return filled > 0 && numeric / filled >= 0.8
  })
}

/** Sugere a coluna que identifica cada registro (valores únicos e quase sempre preenchidos). */
export function suggestKeyColumn(columns: string[], rows: Row[]): string | null {
  if (!rows.length) return null
  let best: { col: string; score: number } | null = null
  columns.forEach((col, idx) => {
    const seen = new Set<string>()
    let filled = 0
    let dup = false
    for (const r of rows) {
      const v = normalize(r[col])
      if (!v) continue
      filled++
      if (seen.has(v)) {
        dup = true
        break
      }
      seen.add(v)
    }
    if (dup || filled / rows.length < 0.95) return
    const hasDecimals = rows.some((r) => {
      const n = toNumber(r[col])
      return n !== null && !Number.isInteger(n)
    })
    if (hasDecimals) return
    const score = (KEY_HINTS.test(col.trim()) ? 100 : 0) + (columns.length - idx)
    if (!best || score > best.score) best = { col, score }
  })
  return (best as { col: string } | null)?.col ?? null
}

function keyed(rows: Row[], keyColumn: string | null, columns: string[]): { map: Map<string, Row>; dups: number } {
  const map = new Map<string, Row>()
  const count = new Map<string, number>()
  let dups = 0
  for (const r of rows) {
    const base = keyColumn ? normalize(r[keyColumn]) || '(sem chave)' : columns.map((c) => normalize(r[c])).join('␟')
    const n = (count.get(base) ?? 0) + 1
    count.set(base, n)
    if (n > 1 && keyColumn) dups++
    map.set(n === 1 ? base : `${base} #${n}`, r)
  }
  return { map, dups }
}

function displayKey(key: string, row: Row, keyColumn: string | null, columns: string[]): string {
  if (keyColumn) return key
  return columns
    .slice(0, 3)
    .map((c) => fmtCell(row[c]))
    .join(' · ')
}

/**
 * Compara duas versões de uma tabela.
 * Com coluna-chave: identifica registros novos, removidos e alterados (célula a célula).
 * Sem chave: compara linhas inteiras (só novos e removidos).
 */
export function compareVersions(
  before: { columns: string[]; rows: Row[] },
  after: { columns: string[]; rows: Row[] },
  keyColumn: string | null,
): Comparison {
  const beforeSet = new Set(before.columns)
  const afterSet = new Set(after.columns)
  const commonColumns = after.columns.filter((c) => beforeSet.has(c))
  const columnsAdded = after.columns.filter((c) => !beforeSet.has(c))
  const columnsRemoved = before.columns.filter((c) => !afterSet.has(c))
  const key = keyColumn && beforeSet.has(keyColumn) && afterSet.has(keyColumn) ? keyColumn : null

  const a = keyed(before.rows, key, commonColumns)
  const b = keyed(after.rows, key, commonColumns)

  const added: Comparison['added'] = []
  const removed: Comparison['removed'] = []
  const modified: ModifiedRow[] = []
  let unchanged = 0
  const compareCols = commonColumns.filter((c) => c !== key)
  const stats = new Map<string, ColumnStat>(compareCols.map((c) => [c, { column: c, changed: 0, filled: 0, cleared: 0 }]))

  for (const [k, row] of b.map) {
    const prev = a.map.get(k)
    if (!prev) {
      added.push({ key: displayKey(k, row, key, commonColumns), row })
      continue
    }
    const changes: CellChange[] = []
    for (const col of compareCols) {
      if (sameValue(prev[col], row[col])) continue
      const nb = toNumber(prev[col])
      const na = toNumber(row[col])
      const delta = nb !== null && na !== null ? na - nb : null
      changes.push({
        key: k,
        column: col,
        before: prev[col] ?? null,
        after: row[col] ?? null,
        delta,
        pct: delta !== null && nb !== 0 && nb !== null ? delta / Math.abs(nb) : null,
      })
      const s = stats.get(col)!
      s.changed++
      if (isEmpty(prev[col])) s.filled++
      else if (isEmpty(row[col])) s.cleared++
    }
    if (changes.length) modified.push({ key: k, before: prev, after: row, changes })
    else unchanged++
  }
  for (const [k, row] of a.map) if (!b.map.has(k)) removed.push({ key: displayKey(k, row, key, commonColumns), row })

  const numericCols = detectNumericColumns(commonColumns, [...before.rows.slice(0, 2000), ...after.rows.slice(0, 2000)], key)
  const numeric = numericCols.map((col) => summarizeNumeric(col, before.rows, after.rows))

  const cellChanges = modified.flatMap((m) => m.changes)
  const topMovers = cellChanges
    .filter((c) => c.delta !== null && c.delta !== 0)
    .sort((x, y) => Math.abs(y.delta!) - Math.abs(x.delta!))
    .slice(0, 10)

  const result: Comparison = {
    keyColumn: key,
    totalBefore: before.rows.length,
    totalAfter: after.rows.length,
    added,
    removed,
    modified,
    unchanged,
    duplicateKeys: a.dups + b.dups,
    columnsAdded,
    columnsRemoved,
    commonColumns,
    columnStats: [...stats.values()].sort((x, y) => y.changed - x.changed),
    numeric,
    cellChanges,
    topMovers,
    insights: [],
  }
  result.insights = buildInsights(result)
  return result
}

function summarizeNumeric(column: string, before: Row[], after: Row[]): NumericSummary {
  const agg = (rows: Row[]) => {
    let sum = 0
    let n = 0
    for (const r of rows) {
      const v = toNumber(r[column])
      if (v === null) continue
      sum += v
      n++
    }
    return { sum, avg: n ? sum / n : null }
  }
  const x = agg(before)
  const y = agg(after)
  const delta = y.sum - x.sum
  return {
    column,
    sumBefore: x.sum,
    sumAfter: y.sum,
    avgBefore: x.avg,
    avgAfter: y.avg,
    delta,
    pct: x.sum !== 0 ? delta / Math.abs(x.sum) : null,
  }
}

function buildInsights(c: Comparison): Insight[] {
  const out: Insight[] = []
  const diff = c.totalAfter - c.totalBefore
  const pct = c.totalBefore ? diff / c.totalBefore : null
  out.push({
    tone: diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral',
    title: diff === 0 ? 'Quantidade de registros estável' : `Registros ${diff > 0 ? 'aumentaram' : 'diminuíram'} ${fmtSignedPct(pct)}`,
    detail: `A tabela passou de ${fmt(c.totalBefore)} para ${fmt(c.totalAfter)} registros (${fmtSigned(diff)}): ${fmt(c.added.length)} novos e ${fmt(c.removed.length)} removidos.`,
  })

  const affected = c.added.length + c.removed.length + c.modified.length
  if (c.totalBefore > 0) {
    const rate = affected / Math.max(c.totalBefore, c.totalAfter)
    out.push({
      tone: rate > 0.3 ? 'warn' : 'neutral',
      title: `${fmtPct(rate)} da base foi afetada`,
      detail: c.keyColumn
        ? `${fmt(c.modified.length)} registros tiveram ao menos um valor alterado e ${fmt(c.unchanged)} ficaram idênticos.`
        : 'Sem coluna-chave, linhas alteradas aparecem como uma removida e uma nova. Defina a chave para ver as alterações célula a célula.',
    })
  }

  const totalCells = c.cellChanges.length
  const top = c.columnStats[0]
  if (top && top.changed > 0) {
    const share = top.changed / totalCells
    const extras = c.columnStats.slice(1, 3).filter((s) => s.changed > 0)
    out.push({
      tone: 'neutral',
      title: `"${top.column}" foi a coluna que mais mudou`,
      detail: `${fmt(top.changed)} alterações (${fmtPct(share)} de todas as ${fmt(totalCells)} mudanças de valor)${
        extras.length ? `, seguida de ${extras.map((s) => `"${s.column}" (${fmt(s.changed)})`).join(' e ')}` : ''
      }.`,
    })
  }

  const movers = [...c.numeric].filter((n) => n.delta !== 0).sort((x, y) => Math.abs(y.pct ?? 0) - Math.abs(x.pct ?? 0))
  for (const n of movers.slice(0, 3)) {
    out.push({
      tone: n.delta > 0 ? 'up' : 'down',
      title: `Total de "${n.column}" ${n.delta > 0 ? 'subiu' : 'caiu'} ${n.pct !== null ? fmtSignedPct(n.pct) : fmtSigned(n.delta)}`,
      detail: `Soma foi de ${fmt(n.sumBefore)} para ${fmt(n.sumAfter)} (${fmtSigned(n.delta)}). Média: ${fmt(n.avgBefore)} → ${fmt(n.avgAfter)}.`,
    })
  }

  const m = c.topMovers[0]
  if (m) {
    out.push({
      tone: m.delta! > 0 ? 'up' : 'down',
      title: 'Maior variação individual',
      detail: `Registro "${m.key}", coluna "${m.column}": ${fmtCell(m.before)} → ${fmtCell(m.after)} (${fmtSigned(m.delta)}${
        m.pct !== null ? `, ${fmtSignedPct(m.pct)}` : ''
      }).`,
    })
  }

  const filled = c.columnStats.reduce((s, x) => s + x.filled, 0)
  const cleared = c.columnStats.reduce((s, x) => s + x.cleared, 0)
  if (filled || cleared) {
    out.push({
      tone: cleared > filled ? 'warn' : 'neutral',
      title: 'Preenchimento de dados',
      detail: `${fmt(filled)} campos vazios foram preenchidos e ${fmt(cleared)} campos foram apagados.`,
    })
  }

  if (c.columnsAdded.length || c.columnsRemoved.length) {
    const parts = []
    if (c.columnsAdded.length) parts.push(`novas: ${c.columnsAdded.map((x) => `"${x}"`).join(', ')}`)
    if (c.columnsRemoved.length) parts.push(`removidas: ${c.columnsRemoved.map((x) => `"${x}"`).join(', ')}`)
    out.push({ tone: 'warn', title: 'A estrutura da tabela mudou', detail: `Colunas ${parts.join('; ')}.` })
  }

  if (c.duplicateKeys > 0) {
    out.push({
      tone: 'warn',
      title: 'Chaves repetidas encontradas',
      detail: `${fmt(c.duplicateKeys)} registros repetem o valor de "${c.keyColumn}". Eles foram numerados (#2, #3…) para a comparação; confira se essa é a melhor coluna-chave.`,
    })
  }
  return out
}
