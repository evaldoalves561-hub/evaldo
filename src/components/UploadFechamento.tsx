import { useRef, useState } from 'react'
import { parseWorkbook } from '../lib/parse.ts'
import { BASES, detectBases } from '../lib/fechamento.ts'
import type { Bases } from '../lib/types.ts'
import { fmt, fmtDate } from '../lib/format.ts'
import { Card } from './ui.tsx'

export function UploadFechamento({ onSubmit, onCancel }: { onSubmit: (bases: Bases, label: string, date: string, fileName: string) => Promise<void>; onCancel: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [bases, setBases] = useState<Bases | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [fileName, setFileName] = useState('')
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [label, setLabel] = useState(`Fechamento ${fmtDate(today)}`)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handle(file: File | undefined) {
    if (!file) return
    setError('')
    try {
      const sheets = await parseWorkbook(file)
      const r = detectBases(sheets)
      if (r.missing.length === BASES.length) throw new Error('Não encontrei nenhuma das bases (Alterações, Info UAU, Acomp. Entregas) nesta planilha.')
      setBases(r.bases)
      setWarnings([...r.missing.map((m) => `Base não encontrada: ${m}.`), ...r.warnings])
      setFileName(file.name)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao ler o arquivo.')
    }
  }

  async function save() {
    if (!bases) return
    setBusy(true)
    setError('')
    try {
      await onSubmit(bases, label.trim() || `Fechamento ${fmtDate(date)}`, date, fileName)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar.')
      setBusy(false)
    }
  }

  return (
    <Card title="Enviar fechamento" subtitle='Planilha no formato "Alterações - Fechamento", com as abas Base - Alterações, Base - Info UAU e Base - Acomp. Entregas. A aba Resumo é recalculada pelo app.'>
      <div
        className={`drop ${over ? 'over' : ''}`}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          handle(e.dataTransfer.files[0])
        }}
      >
        {bases ? (
          <>
            <b>{fileName}</b>
            <div className="small" style={{ marginTop: 4 }}>
              {BASES.map((b) => (
                <span key={b.id} style={{ marginRight: 14 }}>
                  {bases[b.id] ? '✓' : '✕'} {b.short}: {bases[b.id] ? `${fmt(bases[b.id]!.rows.length)} linhas` : 'não encontrada'}
                </span>
              ))}
            </div>
          </>
        ) : (
          <>
            <b>Arraste a planilha aqui</b> ou clique para escolher (.xlsx)
          </>
        )}
        <input ref={input} type="file" accept=".xlsx,.xls" hidden onChange={(e) => handle(e.target.files?.[0])} />
      </div>
      {warnings.length > 0 && (
        <div className="notice" style={{ marginTop: 12 }}>
          {warnings.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
      )}
      <div className="upload-grid">
        <label className="field">
          Nome do fechamento
          <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex.: Fechamento Outubro/2026" />
        </label>
        <label className="field">
          Data de referência
          <input
            className="input"
            type="date"
            value={date}
            onChange={(e) => {
              if (label === `Fechamento ${fmtDate(date)}`) setLabel(`Fechamento ${fmtDate(e.target.value)}`)
              setDate(e.target.value)
            }}
          />
        </label>
        <span />
        <div className="toolbar">
          <button className="btn ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button className="btn primary" disabled={busy || !bases} onClick={save}>
            {busy ? 'Salvando…' : 'Salvar fechamento'}
          </button>
        </div>
      </div>
      {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
    </Card>
  )
}
