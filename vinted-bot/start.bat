@echo off
REM Startet den Vinted-Bot unter Windows. Beim ersten Mal wird alles eingerichtet.
cd /d "%~dp0"

if not exist .venv (
  echo Richte Python-Umgebung ein ...
  py -3 -m venv .venv || python -m venv .venv
  .venv\Scripts\python -m pip install -q --upgrade pip
  .venv\Scripts\python -m pip install -q -r requirements.txt
)

if not exist config.yaml (
  copy config.example.yaml config.yaml >nul
  echo config.yaml wurde angelegt - bitte oeffnen, Telegram-Token und Suchen eintragen, dann erneut starten.
  pause
  exit /b 1
)

.venv\Scripts\python -m vinted_bot %*
pause
