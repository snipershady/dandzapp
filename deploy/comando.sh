#!/usr/bin/env bash
# Lancia un comando npm del Tavolo come utente "tavolo", con i parametri di produzione
# (ENV_FILE). Esempi:
#   sudo deploy/comando.sh db:migra
#   sudo deploy/comando.sh avventura:importa -- avventure/sessione-0
#   sudo deploy/comando.sh utente:crea-master -- email@esempio.it "Nome"
#   sudo deploy/comando.sh email:prova -- tuo@indirizzo.it
set -euo pipefail

CARTELLA=${TAVOLO_CARTELLA:-/opt/tavolo}
ENV_FILE=${ENV_FILE:-/etc/tavolo/tavolo.env}
UTENTE=${TAVOLO_UTENTE:-tavolo}

if [[ $# -lt 1 ]]; then
  echo "Uso: $0 <comando npm> [-- argomenti]" >&2
  exit 2
fi
if [[ ! -r $ENV_FILE && $(id -u) -ne 0 ]]; then
  echo "Non riesco a leggere $ENV_FILE: lancia con sudo." >&2
  exit 1
fi

cd "$CARTELLA"
if [[ $(id -un) == "$UTENTE" ]]; then
  exec env ENV_FILE="$ENV_FILE" npm run --silent "$@"
fi
exec sudo -H -u "$UTENTE" env ENV_FILE="$ENV_FILE" npm run --silent "$@"
