import type { RispostaSalute } from '@dandzapp/shared';
import type { FastifyInstance } from 'fastify';
import pacchetto from '../../package.json' with { type: 'json' };
import { databaseRaggiungibile, type Db } from '../db/database.ts';

/** Controllo di salute per il monitoraggio e per la riga di stato del tavolo. */
export function rotteSalute(app: FastifyInstance, db: Db): void {
  app.get('/api/salute', async (_richiesta, risposta) => {
    const dbOk = await databaseRaggiungibile(db);
    const corpo: RispostaSalute = {
      stato: dbOk ? 'ok' : 'degradato',
      database: dbOk ? 'ok' : 'non raggiungibile',
      versione: pacchetto.version,
    };
    return risposta.code(dbOk ? 200 : 503).send(corpo);
  });
}
