# Aba "Cadastros" do Orçamento 2027–2029

Substitui o preenchimento manual da planilha `CONFIGURACAO_ORCAMENTO_2027_2029` (abas 2 e 3) por uma tela dentro do próprio app, visível só para a Controladoria.

| Seção | O que edita | Onde grava |
|---|---|---|
| Empresas e obras | Ativa/inativa, planeja no app ou fora, Regional, obra nova | `restrito/catalogo`, `regras/fora_app`, `regras/regional_obra` |
| Quem planeja | Área de cada insumo por base modelo, ou exceção de uma obra | `regras/depara` (`t` e `o`) e `restrito/areasobra` |
| Gerentes | Linhas da aba 3 (departamento × empresa/obra × gerente, usa o app, Regional) | `restrito/cad_gerentes` e depois o mesmo `carregarAcessos` da planilha |

Nada é gravado até clicar em **Salvar**.

## Como aplicar

```
python aplicar.py caminho/do/index.html
```

Gera `index_cadastros.html` ao lado do original (que não é alterado). Publique esse arquivo no lugar do `index.html`, junto com `config.js` e `supabase-adapter.js` de sempre.
