import fastifyCookie from '@fastify/cookie';
import type { Ruolo } from '@dandzapp/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Config } from '../config.ts';
import type { Db } from '../db/database.ts';
import type { RigaUtente } from '../db/schema.ts';
import { ErroreHttp } from '../http/errori.ts';
import { DURATA_SESSIONE_MS, utenteDaSessione } from './sessioni.ts';

export const COOKIE_SESSIONE = 'sessione';

declare module 'fastify' {
  interface FastifyRequest {
    /** Utente della sessione, o `null` se la richiesta non è autenticata. */
    utente: RigaUtente | null;
  }
}

const METODI_SICURI = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Riconosce l'utente dal cookie di sessione e blocca le richieste che modificano
 * dati se arrivano da un'altra origine (difesa CSRF insieme a SameSite=Lax).
 */
export async function pluginAuth(
  app: FastifyInstance,
  { config, db, ora }: { config: Config; db: Db; ora: () => Date },
): Promise<void> {
  await app.register(fastifyCookie);
  app.decorateRequest('utente', null);

  const origineApp = new URL(config.urlApp).origin;

  app.addHook('onRequest', async (richiesta) => {
    if (!METODI_SICURI.has(richiesta.method)) {
      const origine = richiesta.headers.origin;
      if (origine !== undefined && origine !== origineApp) {
        throw new ErroreHttp(403, 'Richiesta da un sito non autorizzato');
      }
    }
    const token = richiesta.cookies[COOKIE_SESSIONE];
    richiesta.utente = token ? await utenteDaSessione(db, token, ora()) : null;
  });
}

export function opzioniCookie(config: Config) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.urlApp.startsWith('https://'),
    path: '/',
  } as const;
}

export function impostaCookieSessione(risposta: FastifyReply, config: Config, token: string): void {
  risposta.setCookie(COOKIE_SESSIONE, token, {
    ...opzioniCookie(config),
    maxAge: DURATA_SESSIONE_MS / 1000,
  });
}

export function cancellaCookieSessione(risposta: FastifyReply, config: Config): void {
  risposta.clearCookie(COOKIE_SESSIONE, opzioniCookie(config));
}

/** Utente autenticato, oppure 401. */
export function richiediUtente(richiesta: FastifyRequest): RigaUtente {
  if (!richiesta.utente) throw new ErroreHttp(401, 'Devi accedere per continuare');
  return richiesta.utente;
}

/** Utente autenticato con il ruolo indicato, oppure 401/403. */
export function richiediRuolo(richiesta: FastifyRequest, ruolo: Ruolo): RigaUtente {
  const utente = richiediUtente(richiesta);
  if (utente.ruolo !== ruolo) throw new ErroreHttp(403, 'Non hai i permessi per questa azione');
  return utente;
}
