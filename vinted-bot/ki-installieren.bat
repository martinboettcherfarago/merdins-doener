@echo off
REM Installiert PyTorch (CPU), open_clip und transformers fuer das eigene Bildmodell des Bots (einmalig, ca. 400 MB).
cd /d "%~dp0"
if not exist .venv (
  echo Bitte zuerst einmal start.bat ausfuehren.
  pause
  exit /b 1
)
echo Installiere PyTorch (CPU-Version) ...
.venv\Scripts\python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
echo Installiere open_clip und transformers (fuer das Mode-Bildmodell) ...
.venv\Scripts\python -m pip install numpy open_clip_torch transformers sentencepiece protobuf
echo.
echo Fertig! Beim naechsten Start laedt der Bot einmalig das Mode-Bildmodell Marqo-FashionSigLIP (ca. 800 MB).
echo Danach in Telegram: /sammeln  (sammelt Tausende Bilder und trainiert das eigene Modell)
pause
