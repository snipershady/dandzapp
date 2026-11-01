# Parte comune degli script di deploy: da includere con `source`, non si lancia da sola.
# Legge la configurazione generale (deploy.conf.esempio) e prepara le funzioni di servizio.

_QUI=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

# Valori già impostati nell'ambiente: hanno la precedenza sul file.
_VARIABILI=(TAVOLO_CARTELLA TAVOLO_UTENTE TAVOLO_GRUPPO TAVOLO_RAMO ENV_FILE TAVOLO_SERVIZIO
  TAVOLO_DATI TAVOLO_BACKUP TAVOLO_BACKUP_CNF TAVOLO_DB TAVOLO_BACKUP_GIORNI)
declare -A _DALL_AMBIENTE=()
for _v in "${_VARIABILI[@]}"; do
  if [[ -n ${!_v-} ]]; then _DALL_AMBIENTE[$_v]=${!_v}; fi
done

_CONF=
for _c in "${TAVOLO_CONF:-}" /etc/tavolo/deploy.conf "$_QUI/deploy.conf"; do
  if [[ -n $_c && -r $_c ]]; then
    _CONF=$_c
    break
  fi
done
if [[ -n ${TAVOLO_CONF:-} && $_CONF != "$TAVOLO_CONF" ]]; then
  echo "Configurazione non leggibile: $TAVOLO_CONF" >&2
  exit 1
fi
if [[ -n $_CONF ]]; then
  # shellcheck disable=SC1090
  source "$_CONF"
fi
for _v in "${!_DALL_AMBIENTE[@]}"; do
  printf -v "$_v" '%s' "${_DALL_AMBIENTE[$_v]}"
done

# Valori predefiniti, se né file né ambiente li indicano.
: "${TAVOLO_CARTELLA:=$(dirname "$_QUI")}"
: "${TAVOLO_UTENTE:=tavolo}"
: "${TAVOLO_GRUPPO:=$TAVOLO_UTENTE}"
: "${TAVOLO_RAMO:=main}"
: "${ENV_FILE:=/etc/tavolo/tavolo.env}"
: "${TAVOLO_SERVIZIO:=tavolo}"
: "${TAVOLO_DATI:=/var/lib/tavolo}"
: "${TAVOLO_BACKUP:=/var/backups/tavolo}"
: "${TAVOLO_BACKUP_CNF:=/etc/tavolo/backup.my.cnf}"
: "${TAVOLO_DB:=tavolo}"
: "${TAVOLO_BACKUP_GIORNI:=14}"
export TAVOLO_CARTELLA TAVOLO_UTENTE ENV_FILE

richiedi_root() {
  if [[ $(id -u) -ne 0 ]]; then
    echo "Lancia questo script da root (non serve sudo): su -  oppure  sudo -i" >&2
    exit 1
  fi
}

# Esegue un comando come utente dell'applicazione, con ENV_FILE. Da root non serve sudo.
come_tavolo() {
  if [[ $(id -un) == "$TAVOLO_UTENTE" ]]; then
    env ENV_FILE="$ENV_FILE" "$@"
  else
    runuser -u "$TAVOLO_UTENTE" -- env HOME="$(getent passwd "$TAVOLO_UTENTE" | cut -d: -f6)" \
      ENV_FILE="$ENV_FILE" "$@"
  fi
}
