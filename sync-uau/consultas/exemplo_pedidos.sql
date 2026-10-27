-- MODELO: troque pela consulta que você já usa para gerar a planilha hoje.
-- Cada coluna do SELECT vira uma coluna da aba, com o mesmo nome (use AS para renomear).
-- Só são aceitos comandos de leitura (SELECT / WITH). O usuário do banco também é somente leitura.
--
-- Dica: se hoje você exporta de um relatório do UAU, peça ao suporte Globaltec ou ao TI
-- a consulta SQL desse relatório, ou use a mesma consulta que alimenta a planilha atual.

SELECT
    p.Empresa            AS Empresa,
    p.Obra               AS Obra,
    p.NumProcesso        AS Num_Processo_Pedido,
    p.Parcela            AS Parcela,
    p.Insumo             AS Insumo,
    p.Usuario            AS Solicitante_Usuario,
    p.Valor              AS Valor
FROM dbo.TABELA_DE_PEDIDOS AS p      -- troque pelo nome real da tabela/visão do UAU
WHERE p.Data >= DATEADD(MONTH, -12, GETDATE());
