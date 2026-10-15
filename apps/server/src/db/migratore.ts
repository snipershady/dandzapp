import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FileMigrationProvider, Migrator } from 'kysely/migration';
import type { Db } from './database.ts';

const cartellaMigrazioni = fileURLToPath(new URL('./migrazioni', import.meta.url));

/**
 * Migrazioni versionate in `src/db/migrazioni/`, eseguite in ordine di nome
 * (prefisso `AAAAMMGG_HHMM_`). Ogni migrazione esporta `up` e `down`.
 */
export function creaMigratore(db: Db): Migrator {
  return new Migrator({
    db,
    provider: new FileMigrationProvider({ fs, path, migrationFolder: cartellaMigrazioni }),
    migrationTableName: 'migrazioni',
    migrationLockTableName: 'migrazioni_lock',
  });
}
