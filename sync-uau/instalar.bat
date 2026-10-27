@echo off
REM Instala o necessario e agenda a sincronizacao. Rode uma vez (clique duplo).
cd /d "%~dp0"

where python >nul 2>nul || (echo Instale o Python 3 em https://www.python.org/downloads/ marcando "Add python to PATH". & pause & exit /b 1)

echo Criando ambiente Python...
python -m venv .venv || (pause & exit /b 1)
".venv\Scripts\python.exe" -m pip install --upgrade pip >nul
".venv\Scripts\python.exe" -m pip install -r requirements.txt || (pause & exit /b 1)

if not exist config.ini (
  copy config.exemplo.ini config.ini >nul
  echo.
  echo Criei o config.ini. Preencha servidor, usuario, senha e Supabase e rode este instalador de novo.
  notepad config.ini
  pause
  exit /b 0
)

echo.
echo Testando conexoes...
call executar.bat --teste || (echo Corrija o config.ini e rode de novo. & pause & exit /b 1)

echo.
set /p HORAS="De quantas em quantas horas sincronizar? (ex.: 1): "
if "%HORAS%"=="" set HORAS=1
schtasks /Create /F /TN "Sincronizacao UAU" /TR "\"%~dp0executar.bat\"" /SC HOURLY /MO %HORAS% /ST 07:00 /RL LIMITED
echo.
echo Pronto. A tarefa "Sincronizacao UAU" roda a cada %HORAS% hora(s). Rodando a primeira agora...
call executar.bat
pause
