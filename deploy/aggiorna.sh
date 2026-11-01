#!/usr/bin/env bash
# Aggiorna il Tavolo all'ultima versione del ramo principale (§15.5):
# git pull, dipendenze, build, migrazioni, riavvio. Da lanciare da root, senza sudo:
#   /opt/tavolo/deploy/aggiorna.sh
# Percorsi, utente, ramo e servizio stanno in deploy.conf (vedi deploy.conf.esempio).
set -euo pipefail
# shellcheck source=_comune.sh
source "$(dirname "${BASH_SOURCE[0]}")/_comune.sh"

richiedi_root
cd "$TAVOLO_CARTELLA"

echo "▸ Codice ($TAVOLO_RAMO)"
come_tavolo git fetch --prune origin
come_tavolo git checkout --quiet "$TAVOLO_RAMO"
come_tavolo git pull --ff-only origin "$TAVOLO_RAMO"
echo "  ora a $(git log -1 --format='%h %s')"

echo "▸ Dipendenze"
come_tavolo npm ci --no-audit --no-fund

echo "▸ Build dell'interfaccia"
come_tavolo npm run build

echo "▸ Migrazioni del database"
come_tavolo npm run --silent db:migra

echo "▸ Riavvio del servizio"
systemctl restart "$TAVOLO_SERVIZIO"
sleep 2
if systemctl is-active --quiet "$TAVOLO_SERVIZIO"; then
  echo "✔ Aggiornato e in funzione."
else
  echo "✘ Il servizio non è partito: journalctl -u $TAVOLO_SERVIZIO -n 50" >&2
  exit 1
fi
