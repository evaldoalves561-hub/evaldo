import type { Cell } from './types.ts'

/** Converte valores numéricos em formato brasileiro ou internacional. Retorna null se não for número. */
export function toNumber(value: Cell): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'boolean') return null
  let s = String(value).trim()
  if (!s) return null
  s = s.replace(/^R\$\s*/i, '').replace(/\s/g, '')
  const isPercent = s.endsWith('%')
  if (isPercent) s = s.slice(0, -1)
  let n: number
  if (/^[-+]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) n = Number(s.replace(/\./g, '').replace(',', '.'))
  else if (/^[-+]?\d+,\d+$/.test(s)) n = Number(s.replace(',', '.'))
  else if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) n = Number(s.replace(/,/g, ''))
  else if (/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) n = Number(s)
  else return null
  return Number.isFinite(n) ? n : null
}

export function isEmpty(value: Cell): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '')
}

/** Normaliza um valor para comparação: números viram número, textos são aparados. */
export function normalize(value: Cell): string {
  if (isEmpty(value)) return ''
  const n = toNumber(value)
  if (n !== null) return String(Math.round(n * 1e9) / 1e9)
  return String(value).trim()
}

export function sameValue(a: Cell, b: Cell): boolean {
  return normalize(a) === normalize(b)
}
