# Relatório de Fechamento

App web para acompanhar, fechamento a fechamento, a planilha **"Alterações - Fechamento"**. A cada envio o app lê as três bases, recalcula a aba Resumo e mostra o que mudou em relação ao fechamento anterior.

## O que o app mostra

- **Resumo do fechamento**: indicadores (valor arrastado, lançamentos, erros de vínculo, pedidos pendentes, valor pendente, % atrasado) com a variação contra o fechamento anterior, conclusões automáticas em texto e as três seções da aba Resumo:
  1. **Valores arrastados**: Total R$ e % por regional, entidade, empresa e usuário.
  2. **Erros de vínculo Pedido x Ordem de Pagamento (Info UAU)**: quantidade e % por motivo, regional, classificação e solicitante; erros corrigidos, novos e que continuam em aberto.
  3. **Pedidos com entrega pendente**: quantidade, Total R$ e % por regional, status, fornecedor e obra; entregas concluídas, novas pendências e pedidos que passaram de "No Prazo" para "Atrasado".
- **Evolução**: gráficos de cada indicador em todos os fechamentos e tabelas regional × fechamento.
- **O que mudou (registros)**: lista de cada registro novo, resolvido ou alterado entre dois fechamentos, com filtros e exportação para CSV.
- **Bases de dados**: as linhas originais de cada base, com busca, filtro por regional e exportação.
- **Usuários e acesso** (administrador): dar acesso por e-mail, escolher o perfil, gerar nova senha e remover acesso.

## Formato da planilha

| Aba | Colunas usadas |
|---|---|
| Base - Alterações | Chave (ou Codigo_emp, Obra_hsi, Prod_hsi, Comp_hsi, Ins_hsi), Entidade, Desc_emp, REGIONAL, UsrAlt_hsi, DifValor |
| Base - Info UAU | Motivo do Erro, Classificacao, Empresa, Obra, Regional, Num_Processo_Pedido, Parcela, Insumo, Solicitante_Usuario |
| Base - Acomp. Entregas | Regional, Status, Empresa_Proc, Obra_Proc, Num_Proc, Nome_pes, SubTotal, descr_obr |

As outras colunas são guardadas e aparecem em "Bases de dados". As abas são reconhecidas pelo nome (Alterações, UAU, Entregas).

## Controle de acesso

- Não existe cadastro público: só entra quem o administrador liberar em **Usuários e acesso**.
- O app gera uma senha temporária; no primeiro acesso a pessoa cria a própria senha.
- Perfis: **Leitor** (vê os relatórios), **Editor** (também envia e exclui fechamentos), **Administrador** (também gerencia usuários).
- As regras ficam no banco (RLS do Supabase), então valem mesmo fora do app. A criação de contas roda na Edge Function `admin-users`, que confere se quem chama é administrador.

## Tecnologias

React + TypeScript + Vite, gráficos com Recharts, leitura de Excel com SheetJS, banco/login/Edge Function no Supabase.

## Rodar localmente

```bash
npm install
npm run dev      # http://localhost:5173
npm test
npm run build    # gera dist/
```

O `.env` aponta para o projeto Supabase `app-comparacao-tabelas`; a chave ali é a publicável (feita para ficar no navegador). `npm run dev -- --mode demo` abre sem Supabase, com os dados só na memória do navegador.

## Banco de dados

`supabase/migrations/0002_fechamentos_acesso.sql` cria `app_users`, `fechamentos` e `fechamento_bases` com as políticas de acesso. A Edge Function fica em `supabase/functions/admin-users`.

## Publicar

`.github/workflows/deploy.yml` testa, gera o build e publica a pasta `dist/` no branch `gh-pages` a cada push na `main`. O GitHub Pages serve esse branch em https://evaldoalves561-hub.github.io/evaldo/ (Settings → Pages → Branch: gh-pages). O repositório é público, o que é seguro aqui porque os dados ficam protegidos pelo login e pelo RLS.
