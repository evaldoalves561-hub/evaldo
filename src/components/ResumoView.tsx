import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Bases, Fechamento } from '../lib/types.ts'
import { BASES, compareBase, fechamentoInsights, kpis, mergeGroups, statusChanges, summarize, type BaseDef, type MergedGroup } from '../lib/fechamento.ts'
import { fmt, fmtBRL, fmtBRLCompact, fmtCompact, fmtPct, fmtSigned, fmtSignedBRL, fmtSignedPct } from '../lib/format.ts'
import { COLORS, Card, ChartTip, Delta, Insights, Kpi, axisProps } from './ui.tsx'
import { GroupTable } from './GroupTable.tsx'

interface Props {
  cur: Fechamento
  curBases: Bases
  prev: Fechamento | null
  prevBases: Bases | null
}

export function ResumoView({ cur, curBases, prev, prevBases }: Props) {
  const k = useMemo(() => kpis(curBases), [curBases])
  const pk = useMemo(() => (prevBases ? kpis(prevBases) : null), [prevBases])
  const insights = useMemo(() => fechamentoInsights(curBases, prevBases), [curBases, prevBases])
  const pctAtr = k.pedidosPendentes ? k.atrasados / k.pedidosPendentes : 0
  const pPctAtr = pk && pk.pedidosPendentes ? pk.atrasados / pk.pedidosPendentes : null

  const foot = (d: number | null, text: string) => (pk ? <Delta value={d} text={`${text} vs anterior`} invert /> : 'sem fechamento anterior')

  return (
    <>
      <div className="grid kpis">
        <Kpi label="Valor arrastado" value={<span className="money">{fmtBRLCompact(k.valorArrastado)}</span>} foot={foot(pk && k.valorArrastado - pk.valorArrastado, pk ? fmtSignedPct((k.valorArrastado - pk.valorArrastado) / (Math.abs(pk.valorArrastado) || 1)) : '')} />
        <Kpi label="Lançamentos arrastados" value={fmt(k.lancamentosArrastados)} foot={foot(pk && k.lancamentosArrastados - pk.lancamentosArrastados, pk ? fmtSigned(k.lancamentosArrastados - pk.lancamentosArrastados) : '')} />
        <Kpi label="Erros de vínculo em aberto" value={fmt(k.erros)} foot={foot(pk && k.erros - pk.erros, pk ? fmtSigned(k.erros - pk.erros) : '')} />
        <Kpi label="Pedidos com entrega pendente" value={fmt(k.pedidosPendentes)} foot={foot(pk && k.pedidosPendentes - pk.pedidosPendentes, pk ? fmtSigned(k.pedidosPendentes - pk.pedidosPendentes) : '')} />
        <Kpi label="Valor pendente de entrega" value={<span className="money">{fmtBRLCompact(k.valorPendente)}</span>} foot={foot(pk && k.valorPendente - pk.valorPendente, pk ? fmtSignedBRL(k.valorPendente - pk.valorPendente) : '')} />
        <Kpi
          label="Pedidos atrasados"
          value={fmtPct(pctAtr)}
          foot={pPctAtr !== null ? <Delta value={pctAtr - pPctAtr} text={`${fmtSigned(Math.round((pctAtr - pPctAtr) * 1000) / 10)} p.p.`} invert /> : `${fmt(k.atrasados)} de ${fmt(k.pedidosPendentes)}`}
        />
      </div>

      <Card title="Principais conclusões" subtitle={prev ? `${cur.label} comparado com ${prev.label}` : `Resumo automático de ${cur.label}`}>
        <Insights items={insights} />
      </Card>

      {BASES.map((def, i) => (
        <BaseSection key={def.id} n={i + 1} def={def} curBases={curBases} prevBases={prevBases} prevLabel={prev?.label ?? null} />
      ))}
    </>
  )
}

function BaseSection({ n, def, curBases, prevBases, prevLabel }: { n: number; def: BaseDef; curBases: Bases; prevBases: Bases | null; prevLabel: string | null }) {
  const table = curBases[def.id]
  const prevTable = prevBases?.[def.id]
  const sum = useMemo(() => summarize(def, table), [def, table])
  const psum = useMemo(() => (prevTable ? summarize(def, prevTable) : null), [def, prevTable])
  const cmp = useMemo(() => (prevTable && table ? compareBase(def, prevTable, table) : null), [def, prevTable, table])
  const [dim, setDim] = useState(def.dims[1].col)
  const first = def.dims[0]
  const merged = (col: string): MergedGroup[] => mergeGroups(sum.groups[col] ?? [], psum ? (psum.groups[col] ?? []) : null)

  if (!table)
    return (
      <section className="section">
        <SectionHead n={n} def={def} />
        <div className="notice">Esta base não foi encontrada na planilha deste fechamento.</div>
      </section>
    )

  const transitions = def.id === 'acomp_entregas' ? statusChanges(cmp) : []
  const toLate = transitions.filter((t) => /atras/i.test(t.to)).reduce((s, t) => s + t.qt, 0)
  const labels =
    def.id === 'info_uau'
      ? { added: 'Novos erros', removed: 'Erros corrigidos', kept: 'Continuam em aberto' }
      : def.id === 'acomp_entregas'
        ? { added: 'Novas pendências', removed: 'Entregas concluídas', kept: 'Continuam pendentes' }
        : { added: 'Novos lançamentos', removed: 'Saíram do relatório', kept: 'Continuam' }

  return (
    <section className="section">
      <SectionHead n={n} def={def} />
      {cmp && (
        <div className="mini-kpis">
          <Mini color={COLORS.removed} label={labels.added} value={fmt(cmp.added.length)} />
          <Mini color={COLORS.added} label={labels.removed} value={fmt(cmp.removed.length)} />
          <Mini label={labels.kept} value={fmt(cmp.modified.length + cmp.unchanged)} />
          {def.id !== 'info_uau' && <Mini color={COLORS.modified} label="Com valores alterados" value={fmt(cmp.modified.length)} />}
          {def.id === 'acomp_entregas' && <Mini color={COLORS.removed} label="Passaram para Atrasado" value={fmt(toLate)} />}
          <span className="muted small" style={{ alignSelf: 'center' }}>em relação a {prevLabel}</span>
        </div>
      )}
      <Card title={`Por ${first.label.toLowerCase()}`} subtitle={def.measure === 'qt' ? 'Quantidade de registros' : 'Total em R$'}>
        <div className={`split ${def.measure === 'ambos' ? 'stack' : ''}`}>
          <div>
            <GroupBars rows={merged(first.col)} byValue={def.measure !== 'qt'} prevLabel={prevLabel} />
          </div>
          <GroupTable label={first.label} rows={merged(first.col)} measure={def.measure} />
        </div>
      </Card>
        <Card
          title={`Por ${def.dims.find((d) => d.col === dim)!.label.toLowerCase()}`}
          actions={
            <div className="segmented" role="tablist">
              {def.dims.slice(1).map((d) => (
                <button key={d.col} className={dim === d.col ? 'active' : ''} onClick={() => setDim(d.col)}>
                  {d.label}
                </button>
              ))}
            </div>
          }
        >
          <GroupTable label={def.dims.find((d) => d.col === dim)!.label} rows={merged(dim)} measure={def.measure} limit={15} />
          {def.id === 'acomp_entregas' && transitions.length > 0 && (
            <p className="small muted" style={{ marginBottom: 0 }}>
              Mudanças de status: {transitions.map((t) => `${t.from} → ${t.to}: ${fmt(t.qt)}`).join(' · ')}
            </p>
          )}
        </Card>
    </section>
  )
}

function SectionHead({ n, def }: { n: number; def: BaseDef }) {
  return (
    <div className="section-head">
      <div>
        <h2>
          <span className="section-num">{n}</span>
          {def.title}
        </h2>
        <p>{def.description}</p>
      </div>
    </div>
  )
}

function Mini({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="mini">
      <div className="l">
        {color && <span className="dot" style={{ background: color }} />}
        {label}
      </div>
      <div className="v">{value}</div>
    </div>
  )
}

function GroupBars({ rows, byValue, prevLabel }: { rows: MergedGroup[]; byValue: boolean; prevLabel: string | null }) {
  const data = rows
    .filter((r) => r.qt > 0)
    .slice(0, 10)
    .map((r) => ({ name: r.name, atual: byValue ? r.total : r.qt, anterior: byValue ? r.totalPrev : r.qtPrev }))
  const hasPrev = prevLabel !== null
  const format = byValue ? fmtBRL : fmt
  return (
    <>
      {hasPrev && (
        <div className="legend" style={{ marginBottom: 4 }}>
          <span><span className="dot" style={{ background: COLORS.s1 }} />Atual</span>
          <span><span className="dot" style={{ background: 'var(--prev-bar)' }} />{prevLabel}</span>
        </div>
      )}
      <ResponsiveContainer width="100%" height={Math.max(140, data.length * (hasPrev ? 34 : 26) + 30)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }} barCategoryGap="22%" barGap={2}>
          <CartesianGrid stroke={COLORS.grid} horizontal={false} />
          <XAxis type="number" {...axisProps} tickFormatter={byValue ? fmtBRLCompact : fmtCompact} />
          <YAxis type="category" dataKey="name" {...axisProps} width={180} tick={{ fill: 'var(--text-2)', fontSize: 11.5 }} tickFormatter={(v: string) => (v.length > 28 ? v.slice(0, 27).trim() + '…' : v)} />
          <Tooltip content={<ChartTip format={format} />} cursor={{ fill: 'var(--surface-2)' }} />
          {hasPrev && <Bar dataKey="anterior" name={prevLabel!} fill="var(--prev-bar)" radius={[0, 4, 4, 0]} isAnimationActive={false} />}
          <Bar dataKey="atual" name="Atual" fill={COLORS.s1} radius={[0, 4, 4, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </>
  )
}
