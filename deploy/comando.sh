#!/usr/bin/env bash
# Lancia un comando npm del Tavolo come utente dell'applicazione, con i parametri di
# produzione (ENV_FILE). Da root, senza sudo. Esempi:
#   deploy/comando.sh db:migra
#   deploy/comando.sh avventura:importa -- avventure/sessione-0
#   deploy/comando.sh utente:crea-master -- email@esempio.it "Nome"
#   deploy/comando.sh email:prova -- tuo@indirizzo.it
# Percorsi e utente stanno in deploy.conf (vedi deploy.conf.esempio).
set -euo pipefail
# shellcheck source=_comune.sh
source "$(dirname "${BASH_SOURCE[0]}")/_comune.sh"

if [[ $# -lt 1 ]]; then
  echo "Uso: $0 <comando npm> [-- argomenti]" >&2
  exit 2
fi
richiedi_root

cd "$TAVOLO_CARTELLA"
come_tavolo npm run --silent "$@"
