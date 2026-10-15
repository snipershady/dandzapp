import { afterAll, expect, it } from 'vitest';
import { creaDatabase } from '../src/db/database.ts';
import { creaMigratore } from '../src/db/migratore.ts';
import { configTest } from './aiuti.ts';

const db = creaDatabase(configTest().db);
afterAll(() => db.destroy());

it('applica tutte le migrazioni sul database di test senza errori', async () => {
  const { error } = await creaMigratore(db).migrateToLatest();
  expect(error).toBeUndefined();
});
