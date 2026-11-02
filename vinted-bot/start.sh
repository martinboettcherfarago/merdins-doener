#!/usr/bin/env bash
# Startet den Vinted-Bot (Mac / Linux / Raspberry Pi). Beim ersten Mal wird alles eingerichtet.
set -e
cd "$(dirname "$0")"

if [ ! -d .venv ]; then
  echo "Richte Python-Umgebung ein …"
  python3 -m venv .venv
  .venv/bin/pip install -q --upgrade pip
fi

# Pakete (neu) installieren, wenn sich requirements.txt geändert hat – z. B. nach einem Update
if ! cmp -s requirements.txt .venv/requirements.installed; then
  echo "Installiere bzw. aktualisiere Pakete …"
  .venv/bin/pip install -q -r requirements.txt
  cp requirements.txt .venv/requirements.installed
fi

if [ ! -f config.yaml ]; then
  cp config.example.yaml config.yaml
  echo "config.yaml wurde angelegt – bitte öffnen, Telegram-Token und Suchen eintragen, dann erneut starten."
  exit 1
fi

exec .venv/bin/python -m vinted_bot "$@"
