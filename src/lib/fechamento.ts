import type { BaseId, Bases, Cell, ParsedTable, Row } from './types.ts'
import { compareVersions, type Comparison } from './diff.ts'
import { isEmpty, toNumber } from './values.ts'
import { fmt, fmtBRL, fmtPct, fmtSigned, fmtSignedBRL, fmtSignedPct } from './format.ts'
import type { Insight } from './diff.ts'

export interface Dim {
  col: string
  label: string
}

export interface BaseDef {
  id: BaseId
  title: string
  short: string
  description: string
  sheet: RegExp
  key: string[]
  /** Colunas usadas para montar a chave quando ela vier vazia (ex.: fórmula sem valor salvo) */
  fallbackKey?: string[]
  value: string | null
  required: string[]
  dims: Dim[]
  /** Como a base é resumida no relatório: por valor (R$), por quantidade ou ambos */
  measure: 'valor' | 'qt' | 'ambos'
}

export const BASES: BaseDef[] = [
  {
    id: 'alteracoes',
    title: 'Valores arrastados no fechamento',
    short: 'Valores arrastados',
    description: 'Valores que foram arrastados por conta do fechamento do sistema (pedidos em aberto, acompanhamento de entrega não concluído e contrato).',
    sheet: /altera/i,
    key: ['Chave'],
    fallbackKey: ['Codigo_emp', 'Obra_hsi', 'Prod_hsi', 'Comp_hsi', 'Ins_hsi'],
    value: 'DifValor',
    required: ['Chave', 'REGIONAL', 'DifValor'],
    dims: [
      { col: 'REGIONAL', label: 'Regional' },
      { col: 'Entidade', label: 'Entidade' },
      { col: 'Desc_emp', label: 'Empresa' },
      { col: 'UsrAlt_hsi', label: 'Usuário da alteração' },
    ],
    measure: 'valor',
  },
  {
    id: 'info_uau',
    title: 'Erros de vínculo Pedido x Ordem de Pagamento',
    short: 'Erros Info UAU',
    description: 'Erros encontrados com vínculos de Pedido e Ordem de Pagamento que ainda não foram corrigidos.',
    sheet: /uau/i,
    key: ['Empresa', 'Obra', 'Num_Processo_Pedido', 'Parcela', 'Insumo'],
    value: null,
    required: ['Motivo do Erro', 'Regional'],
    dims: [
      { col: 'Motivo do Erro', label: 'Motivo do erro' },
      { col: 'Regional', label: 'Regional' },
      { col: 'Classificacao', label: 'Classificação' },
      { col: 'Solicitante_Usuario', label: 'Solicitante' },
    ],
    measure: 'qt',
  },
  {
    id: 'acomp_entregas',
    title: 'Pedidos com acompanhamento de entrega pendente',
    short: 'Entregas pendentes',
    description: 'Pedidos que estão com acompanhamento de entrega pendente.',
    sheet: /entreg/i,
    key: ['Empresa_Proc', 'Obra_Proc', 'Num_Proc'],
    value: 'SubTotal',
    required: ['Regional', 'Status', 'SubTotal'],
    dims: [
      { col: 'Regional', label: 'Regional' },
      { col: 'Status', label: 'Status' },
      { col: 'Nome_pes', label: 'Fornecedor' },
      { col: 'descr_obr', label: 'Obra' },
    ],
    measure: 'ambos',
  },
]

export const BASE_BY_ID = Object.fromEntries(BASES.map((b) => [b.id, b])) as Record<BaseId, BaseDef>
export const KEY_COL = '__chave'

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s_.-]+/g, '')
    .toLowerCase()

/** Encontra a coluna da planilha correspondente ao nome esperado (ignora acentos, espaços e maiúsculas). */
export function findCol(columns: string[], wanted: string): string | null {
  const w = norm(wanted)
  return columns.find((c) => norm(c) === w) ?? null
}

/** Identifica as 3 bases nas abas da planilha enviada. */
export function detectBases(sheets: { sheet: string; table: ParsedTable }[]): { bases: Bases; missing: string[]; warnings: string[] } {
  const bases: Bases = {}
  const missing: string[] = []
  const warnings: string[] = []
  for (const def of BASES) {
    const match =
      sheets.find((s) => def.sheet.test(s.sheet) && /base/i.test(s.sheet)) ??
      sheets.find((s) => def.sheet.test(s.sheet)) ??
      sheets.find((s) => def.required.every((c) => findCol(s.table.columns, c)))
    if (!match) {
      missing.push(def.short)
      continue
    }
    const absent = def.required.filter((c) => !findCol(match.table.columns, c))
    if (absent.length) warnings.push(`${def.short}: colunas não encontradas (${absent.join(', ')}).`)
    bases[def.id] = match.table
  }
  return { bases, missing, warnings }
}

const cell = (row: Row, columns: string[], col: string): Cell => {
  const c = findCol(columns, col)
  return c ? (row[c] ?? null) : null
}

export function rowValue(def: BaseDef, table: ParsedTable, row: Row): number {
  return def.value ? (toNumber(cell(row, table.columns, def.value)) ?? 0) : 0
}

export function rowKey(def: BaseDef, table: ParsedTable, row: Row): string {
  const key = def.key.map((k) => String(cell(row, table.columns, k) ?? '').trim()).join(' · ')
  if (key.replace(/[\s·]/g, '') || !def.fallbackKey) return key
  return def.fallbackKey.map((k) => String(cell(row, table.columns, k) ?? '').trim()).join('-')
}

export interface GroupRow {
  name: string
  qt: number
  total: number
}

export interface BaseSummary {
  qt: number
  total: number
  groups: Record<string, GroupRow[]>
}

export function summarize(def: BaseDef, table: ParsedTable | undefined): BaseSummary {
  const out: BaseSummary = { qt: 0, total: 0, groups: {} }
  if (!table) return out
  const maps = def.dims.map(() => new Map<string, GroupRow>())
  for (const row of table.rows) {
    const v = rowValue(def, table, row)
    out.qt++
    out.total += v
    def.dims.forEach((d, i) => {
      const raw = cell(row, table.columns, d.col)
      const name = isEmpty(raw) ? '(não informado)' : String(raw).trim()
      const g = maps[i].get(name) ?? { name, qt: 0, total: 0 }
      g.qt++
      g.total += v
      maps[i].set(name, g)
    })
  }
  def.dims.forEach((d, i) => {
    out.groups[d.col] = [...maps[i].values()].sort((a, b) => (def.measure === 'qt' ? b.qt - a.qt : b.total - a.total) || b.qt - a.qt)
  })
  return out
}

export interface MergedGroup extends GroupRow {
  qtPrev: number | null
  totalPrev: number | null
}

/** Junta os grupos do fechamento atual com os do anterior para mostrar a variação. */
export function mergeGroups(cur: GroupRow[], prev: GroupRow[] | null): MergedGroup[] {
  const p = new Map((prev ?? []).map((g) => [g.name, g]))
  const rows: MergedGroup[] = cur.map((g) => ({ ...g, qtPrev: prev ? (p.get(g.name)?.qt ?? 0) : null, totalPrev: prev ? (p.get(g.name)?.total ?? 0) : null }))
  if (prev) for (const g of prev) if (!cur.some((c) => c.name === g.name)) rows.push({ name: g.name, qt: 0, total: 0, qtPrev: g.qt, totalPrev: g.total })
  return rows
}

export interface FechamentoKpis {
  valorArrastado: number
  lancamentosArrastados: number
  erros: number
  pedidosPendentes: number
  valorPendente: number
  atrasados: number
  valorAtrasado: number
}

export function kpis(bases: Bases): FechamentoKpis {
  const alt = summarize(BASE_BY_ID.alteracoes, bases.alteracoes)
  const uau = summarize(BASE_BY_ID.info_uau, bases.info_uau)
  const ent = summarize(BASE_BY_ID.acomp_entregas, bases.acomp_entregas)
  const atrasado = (ent.groups.Status ?? []).find((g) => /atras/i.test(g.name))
  return {
    valorArrastado: alt.total,
    lancamentosArrastados: alt.qt,
    erros: uau.qt,
    pedidosPendentes: ent.qt,
    valorPendente: ent.total,
    atrasados: atrasado?.qt ?? 0,
    valorAtrasado: atrasado?.total ?? 0,
  }
}

/** Acrescenta a coluna-chave calculada para comparar registros entre fechamentos. */
export function withKey(def: BaseDef, table: ParsedTable): ParsedTable {
  return {
    columns: [KEY_COL, ...table.columns],
    rows: table.rows.map((r) => ({ [KEY_COL]: rowKey(def, table, r), ...r })),
  }
}

export function compareBase(def: BaseDef, prev: ParsedTable | undefined, cur: ParsedTable | undefined): Comparison | null {
  if (!prev || !cur) return null
  return compareVersions(withKey(def, prev), withKey(def, cur), KEY_COL)
}

/** Pedidos que mudaram de "No Prazo" para "Atrasado" entre dois fechamentos. */
export function statusChanges(cmp: Comparison | null): { from: string; to: string; qt: number }[] {
  if (!cmp) return []
  const m = new Map<string, number>()
  for (const r of cmp.modified)
    for (const c of r.changes)
      if (/^status$/i.test(c.column)) {
        const k = `${c.before ?? '(vazio)'}→${c.after ?? '(vazio)'}`
        m.set(k, (m.get(k) ?? 0) + 1)
      }
  return [...m.entries()].map(([k, qt]) => ({ from: k.split('→')[0], to: k.split('→')[1], qt })).sort((a, b) => b.qt - a.qt)
}

const pctOf = (part: number, whole: number) => (whole ? part / whole : 0)
const change = (cur: number, prev: number) => (prev ? (cur - prev) / Math.abs(prev) : null)

function biggestMover(cur: GroupRow[], prev: GroupRow[], by: 'qt' | 'total') {
  const merged = mergeGroups(cur, prev)
  return merged
    .map((g) => ({ name: g.name, delta: by === 'qt' ? g.qt - (g.qtPrev ?? 0) : g.total - (g.totalPrev ?? 0), prev: by === 'qt' ? g.qtPrev! : g.totalPrev!, cur: by === 'qt' ? g.qt : g.total }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0]
}

/** Conclusões em texto sobre o fechamento (e a comparação com o anterior, se houver). */
export function fechamentoInsights(cur: Bases, prev: Bases | null): Insight[] {
  const out: Insight[] = []
  const altDef = BASE_BY_ID.alteracoes
  const uauDef = BASE_BY_ID.info_uau
  const entDef = BASE_BY_ID.acomp_entregas
  const alt = summarize(altDef, cur.alteracoes)
  const uau = summarize(uauDef, cur.info_uau)
  const ent = summarize(entDef, cur.acomp_entregas)
  const pAlt = prev ? summarize(altDef, prev.alteracoes) : null
  const pUau = prev ? summarize(uauDef, prev.info_uau) : null
  const pEnt = prev ? summarize(entDef, prev.acomp_entregas) : null

  // Valores arrastados
  if (cur.alteracoes) {
    const topReg = alt.groups.REGIONAL?.[0]
    const topEnt = alt.groups.Entidade?.[0]
    if (pAlt && prev?.alteracoes) {
      const d = alt.total - pAlt.total
      out.push({
        tone: d > 0 ? 'down' : d < 0 ? 'up' : 'neutral',
        title: `Valor arrastado ${d > 0 ? 'aumentou' : d < 0 ? 'diminuiu' : 'estável'} ${d ? fmtSignedPct(change(alt.total, pAlt.total)) : ''}`.trim(),
        detail: `Passou de ${fmtBRL(pAlt.total)} para ${fmtBRL(alt.total)} (${fmtSignedBRL(d)}), em ${fmt(alt.qt)} lançamentos.`,
      })
      const mover = biggestMover(alt.groups.REGIONAL ?? [], pAlt.groups.REGIONAL ?? [], 'total')
      if (mover && mover.delta)
        out.push({
          tone: mover.delta > 0 ? 'down' : 'up',
          title: `${mover.name}: maior variação no valor arrastado`,
          detail: `${fmtBRL(mover.prev)} → ${fmtBRL(mover.cur)} (${fmtSignedBRL(mover.delta)}).`,
        })
    } else if (topReg) {
      out.push({
        tone: 'neutral',
        title: `${fmtBRL(alt.total)} arrastados no fechamento`,
        detail: `${fmt(alt.qt)} lançamentos. ${topReg.name} concentra ${fmtPct(pctOf(topReg.total, alt.total))} do valor (${fmtBRL(topReg.total)}).`,
      })
    }
    if (topEnt && pctOf(topEnt.total, alt.total) > 0.5)
      out.push({
        tone: 'warn',
        title: `${topEnt.name} concentra ${fmtPct(pctOf(topEnt.total, alt.total))} do valor arrastado`,
        detail: `${fmtBRL(topEnt.total)} de ${fmtBRL(alt.total)}. As demais entidades somam ${fmtBRL(alt.total - topEnt.total)}.`,
      })
  }

  // Erros Info UAU
  if (cur.info_uau) {
    const topMotivo = uau.groups['Motivo do Erro']?.[0]
    if (pUau && prev?.info_uau) {
      const cmp = compareBase(uauDef, prev.info_uau, cur.info_uau)!
      out.push({
        tone: uau.qt < pUau.qt ? 'up' : uau.qt > pUau.qt ? 'down' : 'neutral',
        title: `${fmt(cmp.removed.length)} erros corrigidos, ${fmt(cmp.added.length)} novos`,
        detail: `Erros em aberto foram de ${fmt(pUau.qt)} para ${fmt(uau.qt)} (${fmtSigned(uau.qt - pUau.qt)}). Foram corrigidos ${fmtPct(pctOf(cmp.removed.length, pUau.qt))} dos erros do fechamento anterior; ${fmt(cmp.modified.length + cmp.unchanged)} continuam em aberto.`,
      })
      const mover = biggestMover(uau.groups.Regional ?? [], pUau.groups.Regional ?? [], 'qt')
      if (mover && mover.delta)
        out.push({
          tone: mover.delta > 0 ? 'down' : 'up',
          title: `${mover.name}: maior variação de erros`,
          detail: `${fmt(mover.prev)} → ${fmt(mover.cur)} erros (${fmtSigned(mover.delta)}).`,
        })
    } else {
      const topReg = uau.groups.Regional?.[0]
      out.push({
        tone: 'neutral',
        title: `${fmt(uau.qt)} erros de vínculo em aberto`,
        detail: topReg ? `${topReg.name} tem a maior quantidade: ${fmt(topReg.qt)} (${fmtPct(pctOf(topReg.qt, uau.qt))}).` : '',
      })
    }
    if (topMotivo)
      out.push({
        tone: 'warn',
        title: `Principal motivo: ${topMotivo.name.trim()}`,
        detail: `${fmt(topMotivo.qt)} ocorrências, ${fmtPct(pctOf(topMotivo.qt, uau.qt))} de todos os erros.`,
      })
  }

  // Entregas pendentes
  if (cur.acomp_entregas) {
    const atr = (ent.groups.Status ?? []).find((g) => /atras/i.test(g.name))
    if (pEnt && prev?.acomp_entregas) {
      const cmp = compareBase(entDef, prev.acomp_entregas, cur.acomp_entregas)!
      const toLate = statusChanges(cmp).filter((s) => /atras/i.test(s.to)).reduce((s, x) => s + x.qt, 0)
      out.push({
        tone: ent.qt < pEnt.qt ? 'up' : ent.qt > pEnt.qt ? 'down' : 'neutral',
        title: `${fmt(cmp.removed.length)} entregas concluídas, ${fmt(cmp.added.length)} novas pendências`,
        detail: `Pedidos pendentes foram de ${fmt(pEnt.qt)} para ${fmt(ent.qt)}; valor pendente de ${fmtBRL(pEnt.total)} para ${fmtBRL(ent.total)}.${toLate ? ` ${fmt(toLate)} pedidos passaram de "No Prazo" para "Atrasado".` : ''}`,
      })
    }
    if (atr)
      out.push({
        tone: pctOf(atr.qt, ent.qt) > 0.5 ? 'down' : 'warn',
        title: `${fmtPct(pctOf(atr.qt, ent.qt))} dos pedidos pendentes estão atrasados`,
        detail: `${fmt(atr.qt)} de ${fmt(ent.qt)} pedidos, somando ${fmtBRL(atr.total)} (${fmtPct(pctOf(atr.total, ent.total))} do valor pendente).`,
      })
  }
  return out
}
