import { sql } from 'kysely';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { costruisciApp } from '../src/app.ts';
import { caricaConfig, type Config } from '../src/config.ts';
import { creaDatabase, type Db } from '../src/db/database.ts';
import type { Email, Postino } from '../src/email/postino.ts';

/** Configurazione dei test: database DB_TEST_* (impostato in vitest.config.ts). */
export function configTest(modifiche: Partial<Config> = {}): Config {
  return { ...caricaConfig(), cartellaWeb: null, ...modifiche };
}

export type Contesto = {
  app: FastifyInstance;
  db: Db;
  config: Config;
  /** Email "inviate" durante il test. */
  posta: Email[];
  /** Sposta in avanti l'orologio del server. */
  avanza(ms: number): void;
  chiudi(): Promise<void>;
};

const TABELLE = [
  'zone_scoperte',
  'inviti',
  'partecipazioni',
  'personaggi',
  'partite',
  'avventure',
  'recuperi_password',
  'sessioni',
  'utenti',
] as const;

/** App con database di test vuoto, posta finta e orologio controllabile. */
export async function creaContesto(modifiche: Partial<Config> = {}): Promise<Contesto> {
  const config = configTest(modifiche);
  if (!config.db.nome.endsWith('_test')) {
    throw new Error(`Rifiuto di svuotare "${config.db.nome}": non è un database di test`);
  }
  const db = creaDatabase(config.db);
  await sql`SET FOREIGN_KEY_CHECKS = 0`.execute(db);
  for (const tabella of TABELLE) await sql`TRUNCATE TABLE ${sql.table(tabella)}`.execute(db);
  await sql`SET FOREIGN_KEY_CHECKS = 1`.execute(db);

  const posta: Email[] = [];
  const postino: Postino = {
    async invia(email) {
      posta.push(email);
    },
  };
  let spostamento = 0;
  const app = await costruisciApp({
    config,
    db,
    postino,
    ora: () => new Date(Date.now() + spostamento),
  });

  return {
    app,
    db,
    config,
    posta,
    avanza(ms) {
      spostamento += ms;
    },
    async chiudi() {
      await app.close();
      await db.destroy();
    },
  };
}

export const PASSWORD = 'una-password-lunga';

/** Registra un utente e restituisce il token di sessione. */
export async function registra(
  app: FastifyInstance,
  dati: { email: string; nome?: string; password?: string },
): Promise<string> {
  const risposta = await app.inject({
    method: 'POST',
    url: '/api/auth/registrazione',
    payload: { nome: 'Utente di prova', password: PASSWORD, ...dati },
  });
  if (risposta.statusCode !== 201) throw new Error(`Registrazione fallita: ${risposta.body}`);
  return tokenSessione(risposta);
}

export function tokenSessione(risposta: LightMyRequestResponse): string {
  const cookie = risposta.cookies.find((c) => c.name === 'sessione');
  if (!cookie?.value) throw new Error('Cookie di sessione assente');
  return cookie.value;
}

export function io(app: FastifyInstance, token: string): Promise<LightMyRequestResponse> {
  return app.inject({ method: 'GET', url: '/api/auth/io', cookies: { sessione: token } });
}
