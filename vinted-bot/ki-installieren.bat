@echo off
REM Installiert PyTorch (CPU) und open_clip fuer das eigene Bildmodell des Bots (einmalig, ca. 300 MB).
cd /d "%~dp0"
if not exist .venv (
  echo Bitte zuerst einmal start.bat ausfuehren.
  pause
  exit /b 1
)
echo Installiere PyTorch (CPU-Version) ...
.venv\Scripts\python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
echo Installiere open_clip ...
.venv\Scripts\python -m pip install open_clip_torch
echo.
echo Fertig! Beim naechsten Start laedt der Bot einmalig das Bild-Grundmodell (ca. 600 MB).
echo Danach in Telegram: /sammeln  (sammelt Tausende Bilder und trainiert das eigene Modell)
pause
