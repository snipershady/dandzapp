import { afterAll, describe, expect, it } from 'vitest';
import { RispostaSalute } from '@dandzapp/shared';
import { costruisciApp } from '../src/app.ts';
import { creaDatabase } from '../src/db/database.ts';
import { configTest } from './aiuti.ts';

describe('GET /api/salute', () => {
  const config = configTest();
  const db = creaDatabase(config.db);
  afterAll(() => db.destroy());

  it('risponde ok quando il database è raggiungibile', async () => {
    const app = await costruisciApp({ config, db });
    const risposta = await app.inject({ method: 'GET', url: '/api/salute' });

    expect(risposta.statusCode).toBe(200);
    const corpo = RispostaSalute.parse(risposta.json());
    expect(corpo).toMatchObject({ stato: 'ok', database: 'ok' });
  });

  it('risponde 503 quando il database non è raggiungibile', async () => {
    const dbSpento = creaDatabase({ ...config.db, host: '127.0.0.1', porta: 1 });
    const app = await costruisciApp({ config, db: dbSpento });
    try {
      const risposta = await app.inject({ method: 'GET', url: '/api/salute' });
      expect(risposta.statusCode).toBe(503);
      expect(risposta.json()).toMatchObject({ stato: 'degradato', database: 'non raggiungibile' });
    } finally {
      await dbSpento.destroy();
    }
  });
});

describe('rotte sconosciute', () => {
  it('rispondono 404 in JSON sotto /api', async () => {
    const config = configTest();
    const db = creaDatabase(config.db);
    const app = await costruisciApp({ config, db });
    try {
      const risposta = await app.inject({ method: 'GET', url: '/api/inesistente' });
      expect(risposta.statusCode).toBe(404);
      expect(risposta.json()).toEqual({ errore: 'Risorsa non trovata' });
    } finally {
      await db.destroy();
    }
  });
});
