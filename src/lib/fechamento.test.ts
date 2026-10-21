import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fromMatrix } from './parse.ts'
import { BASE_BY_ID, compareBase, detectBases, kpis, rowKey, statusChanges, summarize } from './fechamento.ts'

const alt = (rows: unknown[][]) => fromMatrix([['Chave', 'Entidade', 'Codigo_emp', 'Obra_hsi', 'Prod_hsi', 'Comp_hsi', 'Ins_hsi', 'REGIONAL', 'DifValor'], ...rows])
const ent = (rows: unknown[][]) => fromMatrix([['Regional', 'Status', 'Empresa_Proc', 'Obra_Proc', 'Num_Proc', 'SubTotal'], ...rows])

test('identifica as bases pelo nome das abas', () => {
  const r = detectBases([
    { sheet: 'Resumo', table: fromMatrix([['x']]) },
    { sheet: 'Base - Alterações', table: alt([['k1', 'Engenharia', 3, 1, 1, 'S', 'I', 'SUL', 10]]) },
    { sheet: 'Base - Acomp. Entregas', table: ent([['SUL', 'Atrasado', 3, 1, 1, 100]]) },
  ])
  assert.ok(r.bases.alteracoes && r.bases.acomp_entregas)
  assert.deepEqual(r.missing, ['Erros Info UAU'])
})

test('resume por regional como a aba Resumo', () => {
  const s = summarize(BASE_BY_ID.alteracoes, alt([['a', 'E1', 1, 1, 1, 'S', 'I', 'SUL', 10], ['b', 'E2', 1, 1, 1, 'S', 'I', 'SUL', 5], ['c', 'E1', 1, 1, 1, 'S', 'I', 'NORTE', 30]]))
  assert.equal(s.total, 45)
  assert.deepEqual(s.groups.REGIONAL.map((g) => [g.name, g.total, g.qt]), [['NORTE', 30, 1], ['SUL', 15, 2]])
})

test('monta a chave quando a coluna Chave vem vazia', () => {
  const t = alt([[null, 'E1', 3, 30502, 10001, 'S04453', 'I10471', 'SUL', 1]])
  assert.equal(rowKey(BASE_BY_ID.alteracoes, t, t.rows[0]), '3-30502-10001-S04453-I10471')
})

test('compara fechamentos: concluídas, novas e mudança de status', () => {
  const before = ent([['SUL', 'No Prazo', 3, 1, 1, 100], ['SUL', 'No Prazo', 3, 1, 2, 50], ['NORTE', 'Atrasado', 3, 2, 3, 70]])
  const after = ent([['SUL', 'Atrasado', 3, 1, 1, 100], ['NORTE', 'Atrasado', 3, 2, 3, 70], ['NORTE', 'No Prazo', 3, 2, 4, 20]])
  const c = compareBase(BASE_BY_ID.acomp_entregas, before, after)!
  assert.equal(c.added.length, 1)
  assert.equal(c.removed.length, 1)
  assert.deepEqual(statusChanges(c), [{ from: 'No Prazo', to: 'Atrasado', qt: 1 }])
  const k = kpis({ acomp_entregas: after })
  assert.equal(k.pedidosPendentes, 3)
  assert.equal(k.atrasados, 2)
  assert.equal(k.valorAtrasado, 170)
})
