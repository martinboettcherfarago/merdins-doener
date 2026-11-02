@echo off
REM Startet den Vinted-Bot unter Windows. Beim ersten Mal wird alles eingerichtet.
cd /d "%~dp0"

if not exist .venv (
  echo Richte Python-Umgebung ein ...
  py -3 -m venv .venv || python -m venv .venv
  .venv\Scripts\python -m pip install -q --upgrade pip
)

REM Pakete (neu) installieren, wenn sich requirements.txt geaendert hat - z. B. nach einem Update
fc /b requirements.txt .venv\requirements.installed >nul 2>&1 || (
  echo Installiere bzw. aktualisiere Pakete ...
  .venv\Scripts\python -m pip install -q -r requirements.txt && copy /y requirements.txt .venv\requirements.installed >nul
)

if not exist config.yaml (
  copy config.example.yaml config.yaml >nul
  echo config.yaml wurde angelegt - bitte oeffnen, Telegram-Token und Suchen eintragen, dann erneut starten.
  pause
  exit /b 1
)

.venv\Scripts\python -m vinted_bot %*
pause
