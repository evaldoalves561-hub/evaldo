import { useRef, useState } from 'react'
import { parseFile } from '../lib/parse.ts'
import type { ParsedTable } from '../lib/types.ts'
import { fmt } from '../lib/format.ts'
import { Card } from './ui.tsx'

export function UploadPanel({ onSubmit, nextIndex }: { onSubmit: (t: ParsedTable, label: string, date: string, fileName: string) => Promise<void>; nextIndex: number }) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [parsed, setParsed] = useState<ParsedTable | null>(null)
  const [fileName, setFileName] = useState('')
  const [label, setLabel] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handle(file: File | undefined) {
    if (!file) return
    setError('')
    try {
      const t = await parseFile(file)
      if (!t.columns.length) throw new Error('Não encontrei dados nesse arquivo.')
      setParsed(t)
      setFileName(file.name)
      setLabel(file.name.replace(/\.[^.]+$/, '') || `Versão ${nextIndex}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao ler o arquivo.')
    }
  }

  async function save() {
    if (!parsed) return
    setBusy(true)
    setError('')
    try {
      await onSubmit(parsed, label.trim() || `Versão ${nextIndex}`, date, fileName)
      setParsed(null)
      setFileName('')
      setLabel('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="Enviar nova versão" subtitle="CSV ou Excel (.xlsx, .xls). A primeira linha deve ter os nomes das colunas.">
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
        {parsed ? (
          <>
            <b>{fileName}</b> · {fmt(parsed.rows.length)} registros · {parsed.columns.length} colunas
            <div className="small muted">Colunas: {parsed.columns.slice(0, 8).join(', ')}{parsed.columns.length > 8 ? '…' : ''}</div>
          </>
        ) : (
          <>
            <b>Arraste o arquivo aqui</b> ou clique para escolher
          </>
        )}
        <input ref={input} type="file" accept=".csv,.tsv,.txt,.xlsx,.xls" hidden onChange={(e) => handle(e.target.files?.[0])} />
      </div>
      {parsed && (
        <div className="upload-grid">
          <label className="field">
            Nome da versão
            <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex.: Outubro 2026" />
          </label>
          <label className="field">
            Data de referência
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <span />
          <div className="toolbar">
            <button className="btn ghost" onClick={() => setParsed(null)}>
              Cancelar
            </button>
            <button className="btn primary" disabled={busy} onClick={save}>
              {busy ? 'Salvando…' : 'Salvar versão'}
            </button>
          </div>
        </div>
      )}
      {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
    </Card>
  )
}
