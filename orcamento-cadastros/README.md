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

## Pendências (aba própria)

Fluxo do dia a dia: subir só a **Base da Estrutura** (aba Base - Geral). Toda obra que está na estrutura e ainda não está no app aparece em **Pendências** com sugestões para confirmar:

- Base modelo: 1º a base da mesma obra em outras empresas, 2º a base mais usada no mesmo grupo da obra, 3º a base com estrutura mais parecida. Nas bases atuais esse critério acertou 99,5% e 92% das obras que já tinham base.
- Quem planeja: regra da base para os serviço/insumo da obra; o que não está no modelo vai para a área mais comum daquele serviço/insumo.
- Regional (Grupo_Empresa da estrutura), Gerente Administrativo, responsável pela Controladoria e Gerente Regional: quem já faz isso na empresa, senão na Regional.

“Confirmar” inclui a obra; “Não planejar agora” inclui como Pausada. A segunda parte da aba lista as obras do app sem Gerente Administrativo, Controladoria, Gerente Regional ou gerente em alguma área, com preenchimento por obra ou para a empresa toda.

## Padronizar e ajustes pedidos na aba Pendências

- **Insumos que não estão em nenhum modelo**: decide uma vez por insumo (vale para todas as obras novas). Sugestão pelo mesmo insumo em outros modelos/exceções, senão pelo mesmo serviço. "Ninguém planeja" deixa o insumo fora do app. A obra nova só é confirmada quando base, Regional e esses insumos estão resolvidos; as escolhas viram exceções por obra (`regras/depara` o).
- **Padronizar nomes e Regionais**: compara empresa, obra e Regional do catálogo com a Base da Estrutura (espaços repetidos removidos) e agrupa Regionais escritas de formas diferentes.
- **Obras do app que não estão mais na estrutura**: lista e permite inativar, mostrando em quais empresas a mesma obra aparece.
- **Gerentes e e-mails**: e-mail com espaço/maiúscula, mesmo e-mail com nomes diferentes, mesma pessoa com mais de um e-mail.
- Ao salvar gerentes, a Regional já gravada da obra não é mais sobrescrita pela coluna Regional das linhas de gerente.

## 28/10 (2): Pendências em quadros, acessos dos gerentes e Indicadores

A partir daqui os arquivos do módulo foram extraídos da versão que está no ar (que recebeu ajustes fora deste repositório); `aplicar.py` não reproduz mais o arquivo completo.

- **Pendências em quadros**: Acessos de gerentes · Obras novas · Insumos sem modelo · Falta preencher · Padronizar. Cada quadro mostra a contagem (vermelho/amarelo = fazer, verde = em dia) e só a lista escolhida aparece.
- **Acessos de gerentes**: compara o que o cadastro de gerentes libera com o que está liberado (`restrito/pessoas`). Mostra acessos faltando, acessos dados por fora do cadastro e gerentes cadastrados em obra sem insumo da área (a obra não aparece para a pessoa). "Acertar acessos" traz os de fora para o cadastro; ao Salvar, o acesso é recalculado.
- **Salvar** recalcula os acessos sempre que muda obra nova, situação, área fora do app ou quem planeja (antes só quando a lista de gerentes mudava; por isso um gerente cadastrado não via a obra que entrou depois).
- Formulários antigos de gerente (Gerentes e acessos / Sem gerente) também gravam em `restrito/cad_gerentes` e não apagam mais os outros departamentos da pessoa.
- **Base da Estrutura** também inativa as obras do app que saíram da estrutura ou estão com todas as linhas inativas no ERP (Pausada não muda).
- **Indicadores** mostram quantas obras entram na conta e quantas ficaram fora (inativas, pausadas, fora do app).

## 28/10 (3): modo passo a passo

Botão **Começar passo a passo** na aba Pendências: mostra uma pendência por vez, com a sugestão preenchida, na ordem insumos sem modelo → obras novas (gerente esperando primeiro) → falta preencher → padronizar → acessos. Confirmar (ou Enter), Pular, Voltar ao que pulei, Sair. Usa as mesmas funções das listas, então nada é gravado até Salvar.
