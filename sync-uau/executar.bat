@echo off
REM Roda a sincronizacao UAU -> planilha -> Supabase. Usado pelo Agendador de Tarefas.
cd /d "%~dp0"
".venv\Scripts\python.exe" sync_uau.py %*
