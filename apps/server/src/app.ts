import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Config } from './config.ts';
import type { Db } from './db/database.ts';
import { rotteSalute } from './rotte/salute.ts';

export type Dipendenze = { config: Config; db: Db };

export async function costruisciApp({ config, db }: Dipendenze): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: config.livelloLog },
    // Dietro Apache2/nginx sulla stessa macchina (§15.5): ci si fida solo del proxy locale.
    trustProxy: '127.0.0.1',
  });

  rotteSalute(app, db);

  // In produzione Fastify serve anche la SPA; in sviluppo la serve Vite.
  if (config.cartellaWeb) {
    await app.register(fastifyStatic, { root: config.cartellaWeb, wildcard: false });
  }

  app.setNotFoundHandler((richiesta, risposta) => {
    const pathname = richiesta.url.split('?')[0] ?? '';
    if (config.cartellaWeb && richiesta.method === 'GET' && !pathname.startsWith('/api/')) {
      // Rotte della SPA (es. /partite/42): le risolve il router del browser.
      return risposta.sendFile('index.html');
    }
    return risposta.code(404).send({ errore: 'Risorsa non trovata' });
  });

  return app;
}
