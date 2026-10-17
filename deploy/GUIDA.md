# Messa in linea del Tavolo virtuale

Guida passo passo per installare il tavolo su **Debian 13 (trixie)**:

- **produzione** su `dandzapp.spinfo.it`, con **Apache2**;
- **staging** con **nginx**. Il nome usato negli esempi è `staging.dandzapp.spinfo.it`: va sostituito con quello vero, sia nella configurazione di nginx sia in `APP_URL`.

L'architettura è quella della §15.5 di `CLAUDE.md`:

```
Browser ──HTTPS──▶ Apache2 / nginx (:443, certificato Let's Encrypt)
                        │  proxy (HTTP + WebSocket)
                        ▼
                   Node 24 (systemd, solo 127.0.0.1:3000)
                        │
                        ▼
                   MySQL 9.7 (solo locale)
```

Tutti i comandi vanno lanciati come utente con `sudo`. Le parti in `MAIUSCOLO` vanno adattate.

## File in `deploy/`

| File                                      | A cosa serve                                                                                    |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `tavolo.env.esempio`                      | Modello dei parametri, da copiare in `/etc/tavolo/tavolo.env`                                   |
| `systemd/tavolo.service`                  | Il servizio Node                                                                                |
| `systemd/tavolo-backup.service`, `.timer` | Il backup notturno                                                                              |
| `apache2/dandzapp.conf`                   | Sito Apache2 per la produzione                                                                  |
| `nginx/dandzapp-staging.conf`             | Sito nginx per lo staging                                                                       |
| `comando.sh`                              | Lancia un comando npm (migrazioni, importazioni, email di prova…) con i parametri di produzione |
| `aggiorna.sh`                             | Porta il server all'ultima versione                                                             |
| `backup.sh`                               | Dump del database e copia dei dati, con rotazione                                               |

Le configurazioni di Apache2 e nginx sono state provate in un container Debian 13: rinvio a HTTPS, rinnovo del certificato, proxy, WebSocket, intestazioni di sicurezza, CSP e compressione. Anche `backup.sh` è stato provato, con `mysqldump` di MySQL 9.7.

---

## 1. Preparare la macchina

```bash
sudo apt update && sudo apt full-upgrade -y
sudo apt install -y git curl ca-certificates gnupg ufw certbot

# Firewall: solo SSH, HTTP e HTTPS (§15.5).
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Utente di sistema che fa girare il tavolo (senza login), con le sue cartelle:

```bash
sudo useradd --system --create-home --home-dir /home/tavolo --shell /usr/sbin/nologin tavolo
sudo install -d -o tavolo -g tavolo -m 750 /opt/tavolo /var/lib/tavolo
sudo install -d -o root -g tavolo -m 750 /etc/tavolo
sudo install -d -o root -g root -m 700 /var/backups/tavolo
```

## 2. Node.js 24

Debian 13 ha una versione più vecchia di Node: si usa il repository NodeSource.

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x -o /tmp/nodesource.sh
less /tmp/nodesource.sh          # meglio dare un'occhiata prima di eseguirlo
sudo bash /tmp/nodesource.sh
sudo apt install -y nodejs
node --version                   # deve essere v24.x
```

## 3. MySQL 9.7

Debian 13 ha MariaDB, non MySQL: si usa il repository APT ufficiale di MySQL.

```bash
# Scarica l'ultimo mysql-apt-config da https://dev.mysql.com/downloads/repo/apt/
sudo apt install -y ./mysql-apt-config_*_all.deb   # nella schermata scegli "MySQL 9.7"
sudo apt update
sudo apt install -y mysql-server mysql-client
```

MySQL deve ascoltare solo in locale. In `/etc/mysql/mysql.conf.d/mysqld.cnf`, sezione `[mysqld]`:

```ini
bind-address = 127.0.0.1
mysqlx-bind-address = 127.0.0.1
```

Poi `sudo systemctl restart mysql`.

Schema e utente dell'applicazione, con i privilegi **solo** sul suo schema:

```bash
sudo mysql <<'SQL'
CREATE DATABASE tavolo CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'tavolo'@'localhost' IDENTIFIED BY 'PASSWORD_LUNGA_E_CASUALE';
GRANT ALL PRIVILEGES ON tavolo.* TO 'tavolo'@'localhost';
SQL
```

Per generare una password: `openssl rand -base64 30`.

## 4. Il codice

```bash
sudo -u tavolo git clone https://github.com/snipershady/dandzapp.git /opt/tavolo
cd /opt/tavolo
sudo -u tavolo -H npm ci --no-audit --no-fund
sudo -u tavolo -H npm run build
```

`npm run build` produce `apps/web/build`, che il server Node serve da sé.

## 5. I parametri: `/etc/tavolo/tavolo.env`

Tutti i parametri stanno in **un solo file** in formato `.env`. Lo legge il servizio e lo leggono i comandi lanciati con `deploy/comando.sh`, quindi per cambiare un parametro basta modificarlo lì e riavviare.

```bash
sudo cp /opt/tavolo/deploy/tavolo.env.esempio /etc/tavolo/tavolo.env
sudo chown root:tavolo /etc/tavolo/tavolo.env
sudo chmod 640 /etc/tavolo/tavolo.env
sudo nano /etc/tavolo/tavolo.env
```

Da adattare:

- `APP_URL`: `https://dandzapp.spinfo.it` in produzione, l'indirizzo dello staging nello staging;
- `DB_PASSWORD`: quella scelta al punto 3;
- `MAILER_DSN`: il server di posta (vedi sotto);
- `EMAIL_MITTENTE`: l'indirizzo da cui partono le email. Se contiene spazi, va tra virgolette.

### La posta: `MAILER_DSN`

Inviti e recupero password partono dal server indicato in `MAILER_DSN`, nella forma:

```
MAILER_DSN=smtp://UTENTE:PASSWORD@HOST:PORTA      # STARTTLS, se il server lo offre
MAILER_DSN=smtps://UTENTE:PASSWORD@HOST:465       # TLS diretto
```

- Se `MAILER_DSN` è vuoto, le email non partono: finiscono nel log del servizio (`journalctl -u tavolo`), e il Master può comunque consegnare a mano il link d'invito.
- Caratteri speciali in utente o password vanno codificati: `@` → `%40`, `:` → `%3A`, `/` → `%2F`.
- **Staging (e sviluppo):** la sandbox di Mailtrap, che raccoglie tutte le email senza consegnarle a nessuno: `smtp://UTENTE:PASSWORD@sandbox.smtp.mailtrap.io:2525`, con le credenziali della propria inbox Mailtrap.
- **Produzione:** un servizio che consegna davvero, ad esempio l'SMTP del proprio dominio o "Email Sending" di Mailtrap.
- Il mittente deve essere un indirizzo autorizzato da quel servizio, altrimenti le email finiscono nello spam.

Per cambiare servizio di posta: modificare la riga, poi `sudo systemctl restart tavolo`. Per provarlo:

```bash
sudo /opt/tavolo/deploy/comando.sh email:prova -- tuo@indirizzo.it
```

La password non compare mai nei messaggi: viene sostituita con `***`.

## 6. Database, avventura e primo Master

```bash
cd /opt/tavolo
sudo deploy/comando.sh db:migra
sudo deploy/comando.sh avventura:importa -- avventure/sessione-0
sudo deploy/comando.sh utente:crea-master -- email@del.master "Nome del Master"
```

Il terzo comando stampa (e invia per email) il link, valido 7 giorni, con cui il Master sceglie la password.

## 7. Il servizio

```bash
sudo cp /opt/tavolo/deploy/systemd/tavolo.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now tavolo
systemctl status tavolo
curl -s http://127.0.0.1:3000/api/salute          # {"stato":"ok",...}
```

Il servizio gira come utente `tavolo`, ascolta solo su `127.0.0.1:3000` e può scrivere solo in `/var/lib/tavolo`. Per i log: `journalctl -u tavolo -f`.

### Cos'è e perché si avvia al boot

Il servizio `tavolo` **è l'applicazione**: avvia il server Node (Fastify + Socket.IO), che risponde all'API (`/api/...`) e al tempo reale (`/socket.io/`), tira i dadi, controlla i permessi, filtra gli spoiler e compone la mappa dei giocatori. Apache2 e nginx fanno solo da proxy inverso verso `127.0.0.1:3000`: se il servizio è fermo, il sito risponde 502.

In sviluppo lo stesso server si avvia con `npm run dev`. In produzione se ne occupa systemd, che in più:

- lo fa girare con un utente di sistema senza privilegi (`tavolo`);
- lo riavvia se si ferma per un errore (`Restart=on-failure`);
- ne raccoglie i log (`journalctl`);
- lo chiude in modo ordinato (SIGTERM: chiude i collegamenti e il database).

Si avvia al boot (`enable`) perché è un server sempre acceso, come MySQL e Apache2: dopo un riavvio della macchina il tavolo torna in linea da solo. Parte dopo MySQL (`After=mysql.service`).

### Perché scrive in `/var/lib/tavolo`

`/var/lib/tavolo` è la cartella dei dati (`DATA_DIR` in `tavolo.env`). Lì **non ci sono dati di gioco**: utenti, partite, nebbia, pedine, mostri, tiri e narrazione stanno solo in MySQL, che resta l'unica fonte di verità. Nella cartella ci sono solo immagini:

| Contenuto                                                                           | Percorso                   | Perché non sta in MySQL                                                                                                                                                                                                                                                |
| ----------------------------------------------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Immagini delle avventure importate (`mappa_giocatori.png`, ritagli `segreti/*.png`) | `avventure/<slug>/`        | Le scrive `avventura:importa`. Sono file binari di qualche MB, solo letti: in MySQL appesantirebbero il database e i backup senza vantaggi. La tabella `avventure` contiene la definizione e fa riferimento a questi file.                                             |
| Cache delle mappe composte                                                          | `cache/mappe/<avventura>/` | Per i giocatori il server compone con `sharp` un'immagine con le sole zone scoperte. Rifarla a ogni richiesta sarebbe costoso, quindi la salva qui e la riusa tra le partite con le stesse zone scoperte. Si può cancellare in qualunque momento: si rigenera da sola. |

Durante il gioco il servizio scrive solo la cache; le immagini delle avventure le scrive il comando di importazione.

La cartella sta fuori dal codice (`/opt/tavolo`) e fuori dalla cartella pubblica del web server per due motivi:

- **Sicurezza:** con `ProtectSystem=strict` tutto il filesystem è in sola lettura per il servizio, e `ReadWritePaths=/var/lib/tavolo` apre solo questa cartella. Anche sfruttando un difetto del server, non si potrebbe modificare il codice o il sistema.
- **Niente spoiler:** Apache2 e nginx non possono servire queste immagini come file statici. Passano sempre da Node, che verifica la partecipazione alla partita e le zone scoperte.

Per questo il backup (§9) ha due parti: il dump di MySQL per lo stato e una copia di `/var/lib/tavolo` per le immagini. Le immagini si possono anche ricreare reimportando le avventure dalla cartella `avventure/` del repository; la cache non serve salvarla.

## 8A. Produzione: Apache2 e certificato

```bash
sudo apt install -y apache2
sudo a2enmod proxy proxy_http proxy_wstunnel headers ssl rewrite deflate

# 1) Certificato: la prima volta lo serve il sito predefinito di Debian (cartella /var/www/html).
sudo certbot certonly --webroot -w /var/www/html -d dandzapp.spinfo.it \
  --deploy-hook "systemctl reload apache2"

# 2) Il sito del tavolo.
sudo cp /opt/tavolo/deploy/apache2/dandzapp.conf /etc/apache2/sites-available/
sudo a2ensite dandzapp
sudo apache2ctl configtest            # deve dire "Syntax OK"
sudo systemctl reload apache2
```

Il DNS di `dandzapp.spinfo.it` deve già puntare al server prima di chiedere il certificato.

Il rinnovo è automatico (timer di certbot). Lo si prova con `sudo certbot renew --dry-run`. Il `--deploy-hook` ricarica Apache dopo ogni rinnovo.

## 8B. Staging: nginx e certificato

Prima si sostituisce `staging.dandzapp.spinfo.it` con il nome vero nel file `deploy/nginx/dandzapp-staging.conf` e in `APP_URL`.

```bash
sudo apt install -y nginx

# 1) Certificato, con il sito predefinito di Debian ancora attivo.
sudo certbot certonly --webroot -w /var/www/html -d staging.dandzapp.spinfo.it \
  --deploy-hook "systemctl reload nginx"

# 2) Il sito del tavolo al posto di quello predefinito.
sudo cp /opt/tavolo/deploy/nginx/dandzapp-staging.conf /etc/nginx/sites-available/
sudo ln -s ../sites-available/dandzapp-staging.conf /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t                         # deve dire "test is successful"
sudo systemctl reload nginx
```

Lo staging manda anche `X-Robots-Tag: noindex`, così non finisce nei motori di ricerca.

## 9. Backup

Il backup notturno salva in `/var/backups/tavolo`, per 14 giorni:

- il dump del database (`mysqldump --single-transaction`);
- una copia di `/var/lib/tavolo`, cioè le immagini delle avventure (le mappe composte si rigenerano da sole).

Credenziali per `mysqldump` (quelle dell'utente `tavolo` del database):

```bash
sudo tee /etc/tavolo/backup.my.cnf >/dev/null <<'EOF'
[client]
user=tavolo
password=PASSWORD_DEL_DATABASE
EOF
sudo chmod 600 /etc/tavolo/backup.my.cnf

sudo cp /opt/tavolo/deploy/systemd/tavolo-backup.service /opt/tavolo/deploy/systemd/tavolo-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now tavolo-backup.timer
sudo systemctl start tavolo-backup.service      # primo backup subito, per provarlo
ls -l /var/backups/tavolo
```

Conviene copiare ogni tanto `/var/backups/tavolo` anche fuori dal server.

Parametri facoltativi del backup, come variabili d'ambiente nel servizio:

| Variabile              | Cosa indica              | Predefinito           |
| ---------------------- | ------------------------ | --------------------- |
| `TAVOLO_BACKUP`        | Cartella di destinazione | `/var/backups/tavolo` |
| `TAVOLO_DB`            | Database                 | `tavolo`              |
| `TAVOLO_DATI`          | Cartella dei dati        | `/var/lib/tavolo`     |
| `TAVOLO_BACKUP_GIORNI` | Giorni di conservazione  | `14`                  |

**Ripristino** (a servizio fermo):

```bash
sudo systemctl stop tavolo
gunzip -c /var/backups/tavolo/db-AAAAMMGG-HHMMSS.sql.gz | sudo mysql tavolo
sudo tar -xzf /var/backups/tavolo/dati-AAAAMMGG-HHMMSS.tar.gz -C /var/lib/tavolo
sudo chown -R tavolo:tavolo /var/lib/tavolo
sudo systemctl start tavolo
```

Il Master può anche esportare in JSON una singola partita, dalla sua pagina di gestione (RF-95).

## 10. Aggiornare

```bash
sudo /opt/tavolo/deploy/aggiorna.sh
```

Lo script fa, nell'ordine:

1. `git pull` sul ramo `main`;
2. `npm ci`;
3. la build dell'interfaccia;
4. le migrazioni;
5. il riavvio del servizio, controllando che sia ripartito.

Per aggiornare un altro ramo, ad esempio sullo staging: `sudo TAVOLO_RAMO=nome-ramo /opt/tavolo/deploy/aggiorna.sh`.

Se un'avventura è cambiata (nuovo `avventura.json` o nuove immagini):

```bash
sudo /opt/tavolo/deploy/comando.sh avventura:importa -- avventure/ID
```

## 11. Verifiche dopo la messa in linea

- [ ] `curl -sI https://dandzapp.spinfo.it` mostra `strict-transport-security`, `x-frame-options: DENY` e `content-security-policy: frame-ancestors 'none'…`.
- [ ] `curl -sI http://dandzapp.spinfo.it` risponde 301 verso https.
- [ ] `sudo deploy/comando.sh email:prova -- tuo@indirizzo.it`: l'email arriva.
- [ ] Il Master accede, crea una partita e invita un giocatore; il giocatore accetta dal link.
- [ ] La riga di stato sotto la mappa dice **"Collegato in tempo reale"**: il WebSocket passa dal proxy. Con "Riconnessione…" fisso, si controlla la configurazione del proxy.
- [ ] Nella console del browser (F12) non ci sono errori `Content Security Policy`.
- [ ] `journalctl -u tavolo -n 50` non mostra errori.
- [ ] `sudo systemctl list-timers tavolo-backup.timer` mostra il prossimo backup.

## 12. Problemi comuni

| Sintomo                                                     | Causa probabile                                                                                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| "Configurazione non valida: MAILER_DSN…" all'avvio          | Il DSN non è `smtp://…` o `smtps://…`, oppure contiene un percorso. Controlla anche i caratteri speciali nella password.              |
| Le email non arrivano                                       | `sudo deploy/comando.sh email:prova -- …` mostra l'errore SMTP. Con `MAILER_DSN` vuoto le email sono solo nel log.                    |
| Si accede, ma al tavolo resta "Riconnessione…"              | Il proxy non inoltra l'upgrade a WebSocket (Apache: `upgrade=websocket` e modulo `proxy_wstunnel`; nginx: `Upgrade` e `Connection`).  |
| Accesso impossibile: "Richiesta da un sito non autorizzato" | `APP_URL` diverso dall'indirizzo usato nel browser (anche http/https o la porta): il server rifiuta le richieste da un'altra origine. |
| Il cookie di sessione non resta                             | `APP_URL` deve cominciare con `https://`: solo così il cookie è `Secure`.                                                             |
| `apache2ctl configtest` fallisce sui certificati            | Il certificato non c'è ancora: prima il passo 1 del punto 8A.                                                                         |
| Il backup fallisce con "Access denied"                      | Controlla `/etc/tavolo/backup.my.cnf` e che l'utente abbia i privilegi sullo schema `tavolo`.                                         |
