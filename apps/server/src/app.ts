import fastifyRateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { pluginAuth } from './auth/plugin.ts';
import type { Config } from './config.ts';
import type { Db } from './db/database.ts';
import { creaPostino, type Postino } from './email/postino.ts';
import { gestoreErrori } from './http/errori.ts';
import { rotteAmministrazione } from './rotte/amministrazione.ts';
import { rotteAuth } from './rotte/auth.ts';
import { rotteAvventure } from './rotte/avventure.ts';
import { rottePartite } from './rotte/partite.ts';
import { rotteSalute } from './rotte/salute.ts';
import { avviaTempoReale, type TempoReale } from './tempo-reale/tempo-reale.ts';

export type Dipendenze = {
  config: Config;
  db: Db;
  postino: Postino;
  /** Orologio iniettabile, per i test sulle scadenze. */
  ora: () => Date;
  /** Socket.IO: notifiche ai collegati dopo ogni modifica (§15.3). */
  tempoReale: TempoReale;
};

export async function costruisciApp(
  dipendenze: Pick<Dipendenze, 'config' | 'db'> & Partial<Omit<Dipendenze, 'tempoReale'>>,
): Promise<FastifyInstance> {
  const { config, db } = dipendenze;
  const app = Fastify({
    logger: { level: config.livelloLog },
    // Dietro Apache2/nginx sulla stessa macchina (§15.5): ci si fida solo del proxy locale.
    trustProxy: '127.0.0.1',
  });
  const base = {
    config,
    db,
    postino: dipendenze.postino ?? creaPostino(config, app.log),
    ora: dipendenze.ora ?? (() => new Date()),
  };

  gestoreErrori(app);
  if (config.limiteTentativi) await app.register(fastifyRateLimit, { global: false });
  await pluginAuth(app, base);

  // Socket.IO sullo stesso server HTTP, con lo stesso cookie di sessione.
  const tempoReale = avviaTempoReale(app, base);
  app.addHook('onClose', () => tempoReale.chiudi());
  const completo: Dipendenze = { ...base, tempoReale };

  rotteSalute(app, db);
  rotteAuth(app, completo);
  rotteAmministrazione(app, completo);
  rotteAvventure(app, completo);
  rottePartite(app, completo);

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
