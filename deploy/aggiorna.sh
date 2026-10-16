#!/usr/bin/env bash
# Aggiorna il Tavolo all'ultima versione del ramo principale (§15.5):
# git pull, dipendenze, build, migrazioni, riavvio. Da lanciare con sudo.
#   sudo /opt/tavolo/deploy/aggiorna.sh
set -euo pipefail

CARTELLA=${TAVOLO_CARTELLA:-/opt/tavolo}
UTENTE=${TAVOLO_UTENTE:-tavolo}
RAMO=${TAVOLO_RAMO:-main}
COME_TAVOLO=(sudo -H -u "$UTENTE" env ENV_FILE="${ENV_FILE:-/etc/tavolo/tavolo.env}")

if [[ $(id -u) -ne 0 ]]; then
  echo "Lancia con sudo: serve per riavviare il servizio." >&2
  exit 1
fi
cd "$CARTELLA"

echo "▸ Codice ($RAMO)"
"${COME_TAVOLO[@]}" git fetch --prune origin
"${COME_TAVOLO[@]}" git checkout --quiet "$RAMO"
"${COME_TAVOLO[@]}" git pull --ff-only origin "$RAMO"
echo "  ora a $(git log -1 --format='%h %s')"

echo "▸ Dipendenze"
"${COME_TAVOLO[@]}" npm ci --no-audit --no-fund

echo "▸ Build dell'interfaccia"
"${COME_TAVOLO[@]}" npm run build

echo "▸ Migrazioni del database"
"${COME_TAVOLO[@]}" npm run --silent db:migra

echo "▸ Riavvio del servizio"
systemctl restart tavolo
sleep 2
if systemctl is-active --quiet tavolo; then
  echo "✔ Aggiornato e in funzione."
else
  echo "✘ Il servizio non è partito: journalctl -u tavolo -n 50" >&2
  exit 1
fi
