import { costruisciApp } from './app.ts';
import { caricaConfig } from './config.ts';
import { creaDatabase } from './db/database.ts';

const config = caricaConfig();
const db = creaDatabase(config.db);
const app = await costruisciApp({ config, db });

async function chiudi(segnale: string): Promise<void> {
  app.log.info(`Ricevuto ${segnale}, chiusura in corso`);
  await app.close();
  await db.destroy();
  process.exit(0);
}
process.once('SIGINT', () => void chiudi('SIGINT'));
process.once('SIGTERM', () => void chiudi('SIGTERM'));

await app.listen({ host: config.host, port: config.porta });
