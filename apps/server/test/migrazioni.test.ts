import { NO_MIGRATIONS } from 'kysely/migration';
import { afterAll, expect, it } from 'vitest';
import { creaDatabase } from '../src/db/database.ts';
import { creaMigratore } from '../src/db/migratore.ts';
import { configTest } from './aiuti.ts';

const db = creaDatabase(configTest().db);
afterAll(() => db.destroy());

it('ogni migrazione si annulla e si riapplica senza errori', async () => {
  const migratore = creaMigratore(db);
  const giu = await migratore.migrateTo(NO_MIGRATIONS);
  expect(giu.error).toBeUndefined();
  const su = await migratore.migrateToLatest();
  expect(su.error).toBeUndefined();
});
