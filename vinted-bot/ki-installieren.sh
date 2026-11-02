#!/usr/bin/env bash
# Installiert PyTorch (CPU), open_clip und transformers für das eigene Bildmodell des Bots (einmalig, ca. 400 MB).
set -e
cd "$(dirname "$0")"
[ -d .venv ] || { echo "Bitte zuerst einmal ./start.sh ausführen."; exit 1; }
.venv/bin/pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
.venv/bin/pip install open_clip_torch transformers sentencepiece protobuf
echo "Fertig! Beim nächsten Start lädt der Bot einmalig das Mode-Bildmodell Marqo-FashionSigLIP (ca. 800 MB)."
echo "Danach in Telegram: /sammeln"
