# D&Zapp

Tavolo virtuale per giocare a Dungeons & Dragons BECMI a distanza. Requisiti, stack e piano di sviluppo sono in [`CLAUDE.md`](CLAUDE.md).

## Requisiti

- Node.js 24 LTS
- MySQL 9.7
- Docker (solo per Mailpit, la casella email di sviluppo)

## Primo avvio in sviluppo

```sh
npm install
cp .env.example .env                                  # se non esiste già
sudo mysql < scripts/db/crea-database-sviluppo.sql    # database tavolo e tavolo_test
npm run db:migra
docker compose up -d                                  # Mailpit: http://localhost:8025
npm run dev                                           # http://localhost:5173
```

## Comandi

| Comando                           | Cosa fa                                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------------------- |
| `npm run dev`                     | Server Fastify (porta 3000, riavvio automatico) e Vite (porta 5173, con proxy verso il server) |
| `npm run build`                   | Build della SPA in `apps/web/build`                                                            |
| `npm start`                       | Avvia il server di produzione, che serve anche la build della SPA                              |
| `npm run db:migra`                | Applica le migrazioni mancanti                                                                 |
| `npm run db:annulla`              | Annulla l'ultima migrazione                                                                    |
| `npm test`                        | Test Vitest (database `DB_NAME_TEST`)                                                          |
| `npm run test:e2e`                | Test Playwright su build reale, desktop e telefono (database `DB_NAME_TEST`)                   |
| `npm run lint` / `npm run format` | ESLint e Prettier                                                                              |
| `npm run check`                   | Controllo dei tipi (tsc, svelte-check)                                                         |
| `npm run verifica`                | lint + check + test, da eseguire prima di ogni commit                                          |

Il server gira direttamente con il supporto nativo di Node 24 per TypeScript: niente fase di compilazione.

## Struttura

```
apps/server/      Fastify, Kysely, migrazioni (src/db/migrazioni)
apps/web/         SvelteKit (SPA)
packages/shared/  Schemi Zod e tipi condivisi
scripts/db/       Script SQL di supporto
```
