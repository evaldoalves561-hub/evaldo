# Sincronização UAU → planilha → Supabase

Substitui a exportação manual. Um computador da sua rede (que já enxerga o servidor do UAU) roda este programa de tempos em tempos. Ele:

1. Conecta no SQL Server do UAU com um usuário **somente leitura**.
2. Roda as suas consultas (uma por aba) e gera a planilha Excel, no mesmo formato de hoje.
3. Se você quiser, já envia para o Supabase (o arquivo da planilha ou as linhas direto nas tabelas).

## Por que é seguro

| Risco | Como fica |
|---|---|
| Alterar ou apagar dados do UAU | O usuário do banco só tem leitura (`db_datareader` + `DENY` de gravação). O programa também recusa qualquer consulta que não seja `SELECT`/`WITH` e desfaz a transação ao final. |
| Expor o ERP na internet | Nada é aberto. O programa roda dentro da rede e só **sai** para o Supabase (HTTPS). |
| Vazar senhas | Senhas e chave ficam só no `config.ini` daquele computador. Ele não vai para o GitHub. |
| Falha no meio do envio | No modo `substituir`, as linhas antigas só são apagadas depois que todas as novas entraram. Se der erro, o app continua com os dados anteriores. |
| Não perceber que parou | Tudo fica registrado em `sync_uau.log` (data, linhas por aba, erros). |

## Instalação (Windows, uma vez)

1. **Usuário somente leitura no UAU**: peça ao TI/DBA para rodar `criar_usuario_leitura.sql` no SQL Server (troque a senha e o nome do banco antes).
2. **Driver ODBC**: instale o *Microsoft ODBC Driver 18 for SQL Server* (download gratuito da Microsoft) no computador que vai rodar.
3. **Python 3**: instale em python.org marcando *Add python to PATH*.
4. Copie esta pasta para o computador, por exemplo em `C:\SyncUAU`.
5. Coloque a sua consulta em `consultas\` (troque o `exemplo_pedidos.sql` pela consulta que gera a planilha hoje). Cada coluna do `SELECT` vira uma coluna da aba.
6. Clique duas vezes em `instalar.bat`. Na primeira vez ele abre o `config.ini` para você preencher; rode de novo depois de salvar. Ele testa as conexões e agenda a tarefa **"Sincronizacao UAU"** no Agendador de Tarefas.

O computador precisa ficar ligado nos horários agendados (um servidor ou PC que fica sempre ligado é o ideal).

## Formas de envio (`[supabase] envio` no config.ini)

| Valor | O que acontece | Quando usar |
|---|---|---|
| `nao` | Só gera a planilha na pasta de saída. Você sobe no app como hoje. | Para começar e conferir a planilha. |
| `arquivo` | Envia a planilha para um bucket do Supabase Storage (`uau/Base UAU <data>.xlsx` e `uau/atual.xlsx`). | Se o app lê a planilha de um arquivo. |
| `tabelas` | Grava as linhas de cada aba direto na tabela do Supabase indicada em `tabela =`. | Se o app lê das tabelas (o mais automático: o app já mostra os dados novos). |

Para `tabelas`, rode `executar.bat --sql-tabelas`: ele mostra o `create table` de cada tabela com os tipos certos, para colar no SQL Editor do Supabase. Cada tabela ganha a coluna `sincronizado_em` (data da última atualização, útil para mostrar no app).

A chave do Supabase usada aqui é a **service_role / secret key** (Project Settings → API). Ela só pode ficar neste computador, nunca no app nem no GitHub.

## Comandos

```
executar.bat                 gera e envia conforme o config.ini
executar.bat --teste         só testa as conexões
executar.bat --sem-envio     gera a planilha sem enviar
executar.bat --sql-tabelas   mostra o SQL das tabelas do Supabase
```

Para mudar o horário: Agendador de Tarefas → "Sincronizacao UAU" → Propriedades → Disparadores.
