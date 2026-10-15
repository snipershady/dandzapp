import { caricaConfig } from '../src/config.ts';
import { creaDatabase } from '../src/db/database.ts';
import { creaMigratore } from '../src/db/migratore.ts';

/** Porta il database di test all'ultima migrazione prima di tutti i test. */
export default async function setup(): Promise<void> {
  const config = caricaConfig();
  if (!config.db.nome.endsWith('_test')) {
    throw new Error(`Rifiuto di migrare "${config.db.nome}" dai test: non è un database di test`);
  }
  const db = creaDatabase(config.db);
  try {
    const { error } = await creaMigratore(db).migrateToLatest();
    if (error) throw error;
  } finally {
    await db.destroy();
  }
}
