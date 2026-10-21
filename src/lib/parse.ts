import Papa from 'papaparse'
import type { Cell, ParsedTable, Row } from './types.ts'
import { isEmpty } from './values.ts'

/** Lê todas as abas de um XLSX/XLS (ou o conteúdo de um CSV, como aba única). */
export async function parseWorkbook(file: File): Promise<{ sheet: string; table: ParsedTable }[]> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv') || name.endsWith('.txt') || name.endsWith('.tsv')) {
    return [{ sheet: file.name.replace(/\.[^.]+$/, ''), table: parseCsv(await file.text()) }]
  }
  const XLSX = await import('xlsx')
  const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true })
  return wb.SheetNames.map((sheet) => ({
    sheet,
    table: fromMatrix(XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheet], { header: 1, defval: null, raw: true })),
  }))
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
  if (v instanceof Date) return dateCell(v)
  if (typeof v === 'string') return v.trim() === '' ? null : v.trim()
  if (typeof v === 'number' || typeof v === 'boolean') return v
  return String(v)
}

const pad = (n: number) => String(n).padStart(2, '0')
function dateCell(d: Date): Cell {
  // Células só com hora vêm como datas de 1899/1900
  if (d.getFullYear() < 1901) return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
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
