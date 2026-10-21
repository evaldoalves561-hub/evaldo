import type { Row } from './types.ts'

/** Gera 4 versões fictícias de uma tabela de produtos para o modo demonstração. */
export function sampleVersions(): { label: string; date: string; columns: string[]; rows: Row[] }[] {
  const cats = ['Bebidas', 'Mercearia', 'Limpeza', 'Higiene', 'Padaria']
  const names = ['Café', 'Arroz', 'Feijão', 'Detergente', 'Sabonete', 'Pão de forma', 'Suco', 'Macarrão', 'Shampoo', 'Água sanitária', 'Biscoito', 'Leite', 'Açúcar', 'Óleo', 'Creme dental']
  let seed = 7
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280)
  let rows: Row[] = Array.from({ length: 40 }, (_, i) => ({
    Código: 1001 + i,
    Produto: `${names[i % names.length]} ${Math.floor(i / names.length) + 1}`,
    Categoria: cats[i % cats.length],
    Estoque: Math.round(20 + rnd() * 180),
    Preço: Math.round((3 + rnd() * 40) * 100) / 100,
    Fornecedor: ['Alfa', 'Beta', 'Gama'][i % 3],
  }))
  const columns = ['Código', 'Produto', 'Categoria', 'Estoque', 'Preço', 'Fornecedor']
  const out = [{ label: 'Julho', date: '2026-07-01', columns, rows }]
  let next = 1041
  for (const [label, date] of [['Agosto', '2026-08-01'], ['Setembro', '2026-09-01'], ['Outubro', '2026-10-01']]) {
    rows = rows
      .filter(() => rnd() > 0.06)
      .map((r) => {
        const x = { ...r }
        if (rnd() < 0.45) x.Estoque = Math.max(0, Math.round((x.Estoque as number) * (0.6 + rnd() * 0.7)))
        if (rnd() < 0.2) x.Preço = Math.round((x.Preço as number) * (1 + rnd() * 0.15) * 100) / 100
        if (rnd() < 0.05) x.Fornecedor = ['Alfa', 'Beta', 'Gama', 'Delta'][Math.floor(rnd() * 4)]
        return x
      })
    for (let i = 0; i < 2 + Math.floor(rnd() * 4); i++) {
      rows.push({ Código: next, Produto: `${names[next % names.length]} novo`, Categoria: cats[next % cats.length], Estoque: Math.round(30 + rnd() * 100), Preço: Math.round((5 + rnd() * 30) * 100) / 100, Fornecedor: 'Delta' })
      next++
    }
    out.push({ label, date, columns, rows })
  }
  return out
}
