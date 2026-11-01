#!/usr/bin/env bash
# Installa i file systemd (servizio e backup notturno) adattando percorsi, utente e file
# dei parametri a quelli di deploy.conf. Da root, senza sudo:
#   deploy/installa-systemd.sh
# Rilancialo dopo aver cambiato deploy.conf.
set -euo pipefail
# shellcheck source=_comune.sh
source "$(dirname "${BASH_SOURCE[0]}")/_comune.sh"

richiedi_root
ORIGINE="$_QUI/systemd"
DESTINAZIONE=/etc/systemd/system

# Con il codice sotto /home, ProtectHome=true nasconderebbe la cartella al servizio.
PROTEZIONE_HOME=true
if [[ $TAVOLO_CARTELLA == /home/* ]]; then PROTEZIONE_HOME=read-only; fi

adatta() {
  sed \
    -e "s|^User=.*|User=$TAVOLO_UTENTE|" \
    -e "s|^Group=.*|Group=$TAVOLO_GRUPPO|" \
    -e "s|^WorkingDirectory=.*|WorkingDirectory=$TAVOLO_CARTELLA|" \
    -e "s|^Environment=ENV_FILE=.*|Environment=ENV_FILE=$ENV_FILE|" \
    -e "s|^ProtectHome=.*|ProtectHome=$PROTEZIONE_HOME|" \
    -e "s|^ReadWritePaths=.*|ReadWritePaths=$TAVOLO_DATI|" \
    -e "s|^ExecStart=/.*/deploy/backup.sh|ExecStart=$TAVOLO_CARTELLA/deploy/backup.sh|" \
    "$1"
}

adatta "$ORIGINE/tavolo.service" >"$DESTINAZIONE/$TAVOLO_SERVIZIO.service"
adatta "$ORIGINE/tavolo-backup.service" >"$DESTINAZIONE/$TAVOLO_SERVIZIO-backup.service"
cp "$ORIGINE/tavolo-backup.timer" "$DESTINAZIONE/$TAVOLO_SERVIZIO-backup.timer"

systemctl daemon-reload
echo "Installati in $DESTINAZIONE: $TAVOLO_SERVIZIO.service, $TAVOLO_SERVIZIO-backup.service/.timer"
echo "Per avviarli:  systemctl enable --now $TAVOLO_SERVIZIO $TAVOLO_SERVIZIO-backup.timer"
