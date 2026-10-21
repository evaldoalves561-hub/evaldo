# Comparador de Tabelas

Envie versões de uma mesma tabela (CSV ou Excel) ao longo do tempo e veja, em um painel no estilo relatório, tudo o que mudou:

- **Visão geral**: indicadores (versões, registros, novos/removidos/alterados acumulados), evolução da quantidade de registros, evolução da soma de qualquer coluna numérica, mudanças a cada atualização, colunas que mais mudam e um resumo por versão.
- **Comparar versões**: escolha duas versões e veja conclusões automáticas em texto, alterações por coluna, totais numéricos antes/depois, maiores variações individuais e a lista completa de diferenças (com busca, filtro e exportação para CSV).
- **Histórico**: rastreie um registro pela coluna-chave em todas as versões (células alteradas em destaque) e gerencie as versões enviadas.

A **coluna-chave** (ex.: Código, CPF, ID) identifica cada registro. O app sugere uma automaticamente no primeiro envio; com ela, o app detecta alterações célula a célula. Sem ela, compara linhas inteiras.

## Tecnologias

React + TypeScript + Vite, gráficos com Recharts, leitura de planilhas com SheetJS e PapaParse, dados e login no **Supabase** (Postgres com RLS: cada usuário só vê as próprias tabelas).

## Rodar localmente

```bash
npm install
npm run dev      # abre em http://localhost:5173
npm test         # testes do motor de comparação
npm run build    # gera a pasta dist/
```

O arquivo `.env` já aponta para o projeto Supabase `app-comparacao-tabelas`. A chave ali é a chave **publicável** (feita para ficar no navegador); a proteção dos dados vem das políticas RLS em `supabase/migrations/0001_init.sql`.

Sem as variáveis do Supabase, o app abre em **modo demonstração** (dados salvos só no navegador, com botão "Carregar exemplo").

## Banco de dados

- `datasets`: cada tabela acompanhada (nome, descrição, coluna-chave).
- `dataset_versions`: cada envio (nome da versão, data de referência, colunas e linhas em JSONB).

Para recriar em outro projeto, rode `supabase/migrations/0001_init.sql` no SQL Editor do Supabase.

## Publicar

O workflow `.github/workflows/deploy.yml` testa, gera o build e publica no GitHub Pages a cada push na `main`. Ative em *Settings → Pages → Source: GitHub Actions* (no plano gratuito do GitHub, o Pages exige repositório público). Depois, adicione a URL publicada em *Supabase → Authentication → URL Configuration* para os links de confirmação de e-mail funcionarem.

## Limites desta versão

As linhas ficam em JSONB e são carregadas no navegador para comparar, o que funciona bem até algumas dezenas de milhares de linhas por versão. Para tabelas maiores, o próximo passo é mover a comparação para uma função no banco.
