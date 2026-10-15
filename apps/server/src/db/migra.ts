/**
 * Uso: node src/db/migra.ts su   → applica tutte le migrazioni mancanti
 *      node src/db/migra.ts giu  → annulla l'ultima migrazione
 */
import type { MigrationResultSet } from 'kysely/migration';
import { caricaConfig } from '../config.ts';
import { creaDatabase } from './database.ts';
import { creaMigratore } from './migratore.ts';

const direzione = process.argv[2];
if (direzione !== 'su' && direzione !== 'giu') {
  console.error('Uso: migra.ts su|giu');
  process.exit(2);
}

const config = caricaConfig();
const db = creaDatabase(config.db);
const migratore = creaMigratore(db);

let esito: MigrationResultSet;
try {
  esito = direzione === 'su' ? await migratore.migrateToLatest() : await migratore.migrateDown();
} finally {
  await db.destroy();
}

for (const r of esito.results ?? []) {
  const segno = r.status === 'Success' ? '✔' : r.status === 'Error' ? '✘' : '·';
  console.log(`${segno} ${r.direction === 'Up' ? 'su ' : 'giù'} ${r.migrationName}`);
}
if (esito.error) {
  console.error(`Migrazione fallita sul database "${config.db.nome}":`, esito.error);
  process.exit(1);
}
if (!esito.results?.length) console.log(`Nessuna migrazione da eseguire su "${config.db.nome}".`);
