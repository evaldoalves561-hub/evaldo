import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Dataset, DatasetVersion, ParsedTable } from '../lib/types.ts'
import { store } from '../lib/store.ts'
import { buildHistory, sortVersions } from '../lib/history.ts'
import { suggestKeyColumn } from '../lib/diff.ts'
import { Overview } from './Overview.tsx'
import { CompareView } from './CompareView.tsx'
import { HistoryTab } from './HistoryTab.tsx'
import { UploadPanel } from './UploadPanel.tsx'

type Tab = 'visao' | 'comparar' | 'historico'

export function DatasetView({ dataset, onChanged, onDeleted }: { dataset: Dataset; onChanged: (d: Dataset) => void; onDeleted: () => void }) {
  const [versions, setVersions] = useState<DatasetVersion[] | null>(null)
  const [tab, setTab] = useState<Tab>('visao')
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    try {
      setVersions(sortVersions(await store.listVersions(dataset.id)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar versões.')
    }
  }, [dataset.id])

  useEffect(() => {
    setVersions(null)
    setTab('visao')
    reload()
  }, [reload])

  const allColumns = useMemo(() => [...new Set((versions ?? []).flatMap((v) => v.columns))], [versions])
  const history = useMemo(() => (versions?.length ? buildHistory(versions, dataset.key_column) : null), [versions, dataset.key_column])

  async function setKey(key: string | null) {
    await store.updateDataset(dataset.id, { key_column: key })
    onChanged({ ...dataset, key_column: key })
  }

  async function addVersion(t: ParsedTable, label: string, date: string, fileName: string) {
    await store.addVersion({ dataset_id: dataset.id, label, reference_date: date, file_name: fileName, columns: t.columns, rows: t.rows })
    if (!dataset.key_column) {
      const k = suggestKeyColumn(t.columns, t.rows)
      if (k) await setKey(k)
    }
    await reload()
  }

  async function deleteVersion(v: DatasetVersion) {
    if (!confirm(`Excluir a versão "${v.label}"? Essa ação não pode ser desfeita.`)) return
    await store.deleteVersion(v.id)
    await reload()
  }

  async function deleteDataset() {
    if (!confirm(`Excluir a tabela "${dataset.name}" e todas as suas versões?`)) return
    await store.deleteDataset(dataset.id)
    onDeleted()
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Tabela</div>
          <h1>{dataset.name}</h1>
          {dataset.description && <p className="muted" style={{ margin: '4px 0 0' }}>{dataset.description}</p>}
        </div>
        <div className="toolbar">
          {allColumns.length > 0 && (
            <label className="field">
              Coluna-chave (identifica cada registro)
              <select className="select" value={dataset.key_column ?? ''} onChange={(e) => setKey(e.target.value || null)}>
                <option value="">Nenhuma (comparar linhas inteiras)</option>
                {allColumns.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          )}
          <button className="btn ghost danger" onClick={deleteDataset} style={{ alignSelf: 'flex-end' }}>
            Excluir tabela
          </button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <UploadPanel onSubmit={addVersion} nextIndex={(versions?.length ?? 0) + 1} />

      {versions === null ? (
        <p className="muted">Carregando…</p>
      ) : versions.length === 0 ? (
        <div className="card empty">
          <h2>Nenhuma versão ainda</h2>
          <p>Envie a primeira versão desta tabela. A cada novo envio, o app mostra o que mudou.</p>
        </div>
      ) : (
        <>
          <div className="tabs" role="tablist">
            {(
              [
                ['visao', 'Visão geral'],
                ['comparar', 'Comparar versões'],
                ['historico', 'Histórico'],
              ] as [Tab, string][]
            ).map(([id, name]) => (
              <button key={id} role="tab" aria-selected={tab === id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
                {name}
              </button>
            ))}
          </div>
          {tab === 'visao' && history && <Overview history={history} />}
          {tab === 'comparar' && <CompareView key={versions.map((v) => v.id).join()} versions={versions} keyColumn={dataset.key_column} />}
          {tab === 'historico' && <HistoryTab versions={versions} keyColumn={dataset.key_column} onDelete={deleteVersion} />}
        </>
      )}
    </>
  )
}
