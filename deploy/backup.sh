#!/usr/bin/env bash
# Backup del Tavolo (§15.5): dump del database e copia della cartella dei dati, con
# rotazione. Lo avvia ogni notte tavolo-backup.timer; si può lanciare anche a mano:
#   sudo /opt/tavolo/deploy/backup.sh
#
# Credenziali del database: /etc/tavolo/backup.my.cnf (permessi 600), formato
#   [client]
#   user=tavolo
#   password=...
set -euo pipefail

DESTINAZIONE=${TAVOLO_BACKUP:-/var/backups/tavolo}
OPZIONI_MYSQL=${TAVOLO_BACKUP_CNF:-/etc/tavolo/backup.my.cnf}
DATABASE=${TAVOLO_DB:-tavolo}
DATI=${TAVOLO_DATI:-/var/lib/tavolo}
GIORNI=${TAVOLO_BACKUP_GIORNI:-14}

umask 077
mkdir -p "$DESTINAZIONE"
ORA=$(date +%Y%m%d-%H%M%S)

# --single-transaction: copia coerente senza bloccare il gioco (InnoDB).
# --set-gtid-purged=OFF, --no-tablespaces e --skip-masking-policies (MySQL 9): bastano i
# privilegi sullo schema (niente RELOAD, FLUSH_TABLES, PROCESS o tabelle di sistema).
TEMPORANEO="$DESTINAZIONE/db-$ORA.sql.gz.tmp"
trap 'rm -f "$TEMPORANEO"' EXIT
mysqldump --defaults-extra-file="$OPZIONI_MYSQL" --single-transaction --set-gtid-purged=OFF \
  --no-tablespaces --skip-masking-policies --routines --default-character-set=utf8mb4 \
  "$DATABASE" |
  gzip -9 >"$TEMPORANEO"
mv "$TEMPORANEO" "$DESTINAZIONE/db-$ORA.sql.gz"

# Immagini delle avventure importate; le mappe composte (cache) si rigenerano da sole.
tar --exclude='./cache' -czf "$DESTINAZIONE/dati-$ORA.tar.gz" -C "$DATI" .

find "$DESTINAZIONE" -maxdepth 1 -type f \( -name 'db-*.sql.gz' -o -name 'dati-*.tar.gz' \) \
  -mtime +"$GIORNI" -delete

echo "Backup completato: $DESTINAZIONE/{db,dati}-$ORA"
