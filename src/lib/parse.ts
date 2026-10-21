import Papa from 'papaparse'
import type { Cell, ParsedTable, Row } from './types.ts'
import { isEmpty } from './values.ts'

/** Lê CSV, TXT, XLSX ou XLS e devolve colunas + linhas. Usa a primeira aba das planilhas. */
export async function parseFile(file: File): Promise<ParsedTable> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv') || name.endsWith('.txt') || name.endsWith('.tsv')) {
    return parseCsv(await file.text())
  }
  const XLSX = await import('xlsx')
  const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: true })
  return fromMatrix(matrix)
}

export function parseCsv(text: string): ParsedTable {
  const result = Papa.parse<string[]>(text.replace(/^﻿/, ''), { skipEmptyLines: 'greedy' })
  return fromMatrix(result.data)
}

export function fromMatrix(matrix: unknown[][]): ParsedTable {
  const headerIndex = matrix.findIndex((r) => r.some((c) => !isEmpty(toCell(c))))
  if (headerIndex < 0) return { columns: [], rows: [] }
  const columns = uniqueHeaders(matrix[headerIndex].map((c) => String(toCell(c) ?? '').trim()))
  const rows: Row[] = []
  for (const raw of matrix.slice(headerIndex + 1)) {
    if (!raw.some((c) => !isEmpty(toCell(c)))) continue
    const row: Row = {}
    columns.forEach((col, i) => (row[col] = toCell(raw[i])))
    rows.push(row)
  }
  return { columns, rows }
}

function toCell(v: unknown): Cell {
  if (v === undefined || v === null) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'string') return v.trim() === '' ? null : v.trim()
  if (typeof v === 'number' || typeof v === 'boolean') return v
  return String(v)
}

function uniqueHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>()
  return headers.map((h, i) => {
    const base = h || `Coluna ${i + 1}`
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    return n === 0 ? base : `${base} (${n + 1})`
  })
}
