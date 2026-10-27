# Aba "Cadastros" do Orçamento 2027–2029

Substitui o preenchimento manual da planilha `CONFIGURACAO_ORCAMENTO_2027_2029` (abas 2 e 3) por uma tela dentro do próprio app, visível só para a Controladoria.

| Seção | O que edita | Onde grava |
|---|---|---|
| Empresas e obras | Ativa/inativa, planeja no app ou fora, Regional, obra nova | `restrito/catalogo`, `regras/fora_app`, `regras/regional_obra` |
| Quem planeja | Área de cada insumo por base modelo, ou exceção de uma obra | `regras/depara` (`t` e `o`) e `restrito/areasobra` |
| Gerentes | Linhas da aba 3 (departamento × empresa/obra × gerente, usa o app, Regional) | `restrito/cad_gerentes` e depois o mesmo `carregarAcessos` da planilha |

Nada é gravado até clicar em **Salvar**.

## Atualizar com Excel (só acrescenta)

No topo da aba, escolha 1 ou 2 arquivos:

1. **Estrutura do ERP**: aba `Base - Geral`, mesmo formato da aba Estrutura.
2. **Obras com situação**: empresa, obra e status (coluna `Status`/`Situação`/`Inativo`, ou a coluna H com 0 = ativa e 1 = inativa).

- Obra nova: a base modelo é a que tem mais serviço/insumo em comum com a estrutura da obra; quem planeja vem da regra padrão; a Regional é a mais comum da empresa; cada área ainda sem gerente ganha uma linha sem e-mail, com sugestão de quem já planeja aquela área na empresa.
- Obra que já existe: só a situação do ERP é atualizada. Regras, exceções, gerentes, Regionais e obras pausadas/fora do app ficam como estão. Nenhuma obra é apagada.
- **Pausada** (não planejar agora): marcação manual em Empresas e obras. A obra continua ativa no ERP, mas fica como "fora do app" (`regras/fora_app`, `pausada: true`), sai dos pendentes e dos indicadores, e nenhuma importação desfaz isso.

## Como aplicar

```
python aplicar.py caminho/do/index.html
```

Gera `index_cadastros.html` ao lado do original (que não é alterado). Publique esse arquivo no lugar do `index.html`, junto com `config.js` e `supabase-adapter.js` de sempre.
