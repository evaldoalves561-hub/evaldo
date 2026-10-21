const nf = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })
const nfCompact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })
const pf = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 })

export const fmt = (n: number | null | undefined) => (n === null || n === undefined || Number.isNaN(n) ? '—' : nf.format(n))
export const fmtCompact = (n: number) => (Math.abs(n) >= 10000 ? nfCompact.format(n) : nf.format(n))
export const fmtPct = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : pf.format(n))
export const fmtSigned = (n: number | null | undefined) => (n === null || n === undefined ? '—' : (n > 0 ? '+' : '') + nf.format(n))
export const fmtSignedPct = (n: number | null | undefined) =>
  n === null || n === undefined || !Number.isFinite(n) ? '—' : (n > 0 ? '+' : '') + pf.format(n)

export function fmtDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}

export function fmtCell(v: unknown): string {
  if (v === null || v === undefined || v === '') return '(vazio)'
  if (typeof v === 'number') return nf.format(v)
  return String(v)
}
