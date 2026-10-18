# D&Zapp

Tavolo virtuale per giocare a Dungeons & Dragons BECMI a distanza. Requisiti, stack e piano di sviluppo sono in [`CLAUDE.md`](CLAUDE.md).

## Requisiti

- Node.js 24 LTS
- MySQL 9.7
- Un database MySQL dedicato ai test (nome che finisce con `_test`, variabili `DB_TEST_*`)
- Docker, per Mailpit (la casella email di sviluppo)
- [uv](https://docs.astral.sh/uv/), solo per generare le mappe (`strumenti/mappe/`)

## Primo avvio in sviluppo

```sh
npm install
cp .env.example .env                 # poi impostare DB_* (sviluppo/staging) e DB_TEST_* (test)
npm run db:migra
docker compose up -d                 # Mailpit (MAILER_DSN=smtp://127.0.0.1:1025): http://localhost:8025
npm run utente:crea-master -- tu@esempio.it "Il tuo nome"   # primo Master: stampa il link per la password
npm run avventura:importa -- avventure/sessione-0         # carica la Sessione 0
npm run dev                          # http://localhost:5173
```

## Comandi

| Comando                                       | Cosa fa                                                                                        |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `npm run dev`                                 | Server Fastify (porta 3010, riavvio automatico) e Vite (porta 5173, con proxy verso il server) |
| `npm run build`                               | Build della SPA in `apps/web/build`                                                            |
| `npm start`                                   | Avvia il server di produzione, che serve anche la build della SPA                              |
| `npm run db:migra`                            | Applica le migrazioni mancanti                                                                 |
| `npm run db:annulla`                          | Annulla l'ultima migrazione                                                                    |
| `npm run utente:crea-master -- email "Nome"`  | Crea il primo Master (o promuove un utente esistente)                                          |
| `npm run email:prova -- indirizzo`            | Spedisce un'email di prova con il server di `MAILER_DSN`                                       |
| `npm run mappa:genera -- avventure/<id>`      | Genera mappe e `avventura.json` da `dungeon.json` (vedi `strumenti/mappe/README.md`)           |
| `npm run avventura:importa -- avventure/<id>` | Importa o aggiorna un'avventura (database e immagini in `DATA_DIR`)                            |
| `npm test`                                    | Test Vitest (database `DB_NAME_TEST`)                                                          |
| `npm run test:e2e`                            | Test Playwright su build reale, desktop e telefono (database `DB_NAME_TEST`)                   |
| `npm run lint` / `npm run format`             | ESLint e Prettier                                                                              |
| `npm run check`                               | Controllo dei tipi (tsc, svelte-check)                                                         |
| `npm run verifica`                            | lint + check + test, da eseguire prima di ogni commit                                          |

Il server gira direttamente con il supporto nativo di Node 24 per TypeScript: niente fase di compilazione.

## Posta

Le email (inviti, recupero password) partono dal server indicato in `MAILER_DSN` nel file `.env`:
`smtp://utente:password@host:porta` oppure `smtps://…`. Per cambiare servizio basta cambiare quella
riga; vuota, le email finiscono solo nel log. Esempi in `.env.example`.

## Messa in linea

Guida completa per Debian 13 (Apache2 in produzione, nginx in staging), con i file di
configurazione, il servizio systemd, l'aggiornamento e i backup: [`deploy/GUIDA.md`](deploy/GUIDA.md).

## Struttura

```
apps/server/      Fastify, Kysely, migrazioni (src/db/migrazioni)
apps/web/         SvelteKit (SPA)
packages/shared/  Schemi Zod e tipi condivisi
scripts/db/       Script SQL di supporto
deploy/           Messa in linea: Apache2, nginx, systemd, aggiornamento, backup, guida
```
