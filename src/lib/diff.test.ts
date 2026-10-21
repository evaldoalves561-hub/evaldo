import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compareVersions, suggestKeyColumn, detectNumericColumns } from './diff.ts'
import { toNumber } from './values.ts'
import { parseCsv } from './parse.ts'

test('toNumber entende formatos brasileiros', () => {
  assert.equal(toNumber('1.234,56'), 1234.56)
  assert.equal(toNumber('R$ 10,5'), 10.5)
  assert.equal(toNumber('1,234.5'), 1234.5)
  assert.equal(toNumber('12'), 12)
  assert.equal(toNumber('abc'), null)
})

const v1 = parseCsv('Código;Nome;Valor;Status\n1;Ana;100;ativo\n2;Bruno;200;ativo\n3;Carla;300;inativo\n')
const v2 = parseCsv('Código;Nome;Valor;Status;Cidade\n1;Ana;150;ativo;SP\n2;Bruno;200;ativo;RJ\n4;Diego;50;ativo;BH\n')

test('sugere a coluna-chave', () => {
  assert.equal(suggestKeyColumn(v1.columns, v1.rows), 'Código')
})

test('detecta colunas numéricas', () => {
  assert.deepEqual(detectNumericColumns(v1.columns, v1.rows, 'Código'), ['Valor'])
})

test('compara versões com chave', () => {
  const c = compareVersions(v1, v2, 'Código')
  assert.equal(c.added.length, 1)
  assert.equal(c.removed.length, 1)
  assert.equal(c.modified.length, 1)
  assert.equal(c.unchanged, 1)
  assert.deepEqual(c.columnsAdded, ['Cidade'])
  assert.equal(c.modified[0].changes[0].delta, 50)
  const valor = c.numeric.find((n) => n.column === 'Valor')!
  assert.equal(valor.sumBefore, 600)
  assert.equal(valor.sumAfter, 400)
  assert.ok(c.insights.length >= 4)
})

test('compara versões sem chave', () => {
  const c = compareVersions(v1, v2, null)
  assert.equal(c.modified.length, 0)
  assert.equal(c.added.length + c.removed.length, 4)
})
