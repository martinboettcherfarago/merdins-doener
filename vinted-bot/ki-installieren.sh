#!/usr/bin/env bash
# Installiert PyTorch (CPU) und open_clip für das eigene Bildmodell des Bots (einmalig, ca. 300 MB).
set -e
cd "$(dirname "$0")"
[ -d .venv ] || { echo "Bitte zuerst einmal ./start.sh ausführen."; exit 1; }
.venv/bin/pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
.venv/bin/pip install open_clip_torch
echo "Fertig! Beim nächsten Start lädt der Bot einmalig das Bild-Grundmodell (ca. 600 MB)."
echo "Danach in Telegram: /sammeln"
