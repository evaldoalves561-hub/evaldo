-- Rode UMA vez no SQL Server do UAU, com um usuário administrador (ex.: no SSMS).
-- Cria um login que só consegue LER o banco. Ele não altera, não apaga e não cria nada.
-- Troque a senha antes de rodar.

USE master;
CREATE LOGIN leitura_app WITH PASSWORD = 'Troque-Esta-Senha-123!', CHECK_POLICY = ON;
GO

USE UAU;   -- nome do banco do UAU
CREATE USER leitura_app FOR LOGIN leitura_app;
ALTER ROLE db_datareader ADD MEMBER leitura_app;   -- só leitura
DENY INSERT, UPDATE, DELETE, EXECUTE, ALTER TO leitura_app;  -- garantia extra
GO
