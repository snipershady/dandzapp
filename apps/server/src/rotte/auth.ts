import {
  CorpoAccesso,
  CorpoPasswordDimenticata,
  CorpoRegistrazione,
  CorpoReimpostaPassword,
  type RispostaUtente,
} from '@dandzapp/shared';
import type { FastifyInstance } from 'fastify';
import type { Dipendenze } from '../app.ts';
import { hashPassword, verificaPassword } from '../auth/password.ts';
import {
  cancellaCookieSessione,
  COOKIE_SESSIONE,
  impostaCookieSessione,
  richiediUtente,
} from '../auth/plugin.ts';
import { consumaRecupero, creaRecupero } from '../auth/recupero-password.ts';
import { chiudiSessione, chiudiSessioniUtente, creaSessione } from '../auth/sessioni.ts';
import { emailRecuperoPassword } from '../email/modelli.ts';
import { ErroreHttp, valida } from '../http/errori.ts';
import {
  aUtentePubblico,
  creaUtente,
  impostaPassword,
  trovaUtentePerEmail,
  trovaUtentePerId,
} from '../utenti/utenti.ts';

/** Limite per indirizzo IP sulle rotte esposte a tentativi ripetuti. */
const limite = (max: number) => ({ config: { rateLimit: { max, timeWindow: '1 minute' } } });

/** Registrazione, accesso, uscita e recupero password (RF-01, RF-01b). */
export function rotteAuth(
  app: FastifyInstance,
  { config, db, postino, ora, tempoReale }: Dipendenze,
): void {
  app.post('/api/auth/registrazione', limite(5), async (richiesta, risposta) => {
    const dati = valida(CorpoRegistrazione, richiesta.body);
    const utente = await creaUtente(db, {
      email: dati.email,
      nome: dati.nome,
      passwordHash: await hashPassword(dati.password),
      ruolo: 'ROLE_PLAYER',
    });
    if (!utente) {
      throw new ErroreHttp(409, 'Esiste già un account con questa email', {
        email: 'Email già registrata: prova ad accedere o a recuperare la password',
      });
    }
    impostaCookieSessione(risposta, config, await creaSessione(db, utente.id, ora()));
    const corpo: RispostaUtente = { utente: aUtentePubblico(utente) };
    return risposta.code(201).send(corpo);
  });

  app.post('/api/auth/accesso', limite(10), async (richiesta, risposta) => {
    const dati = valida(CorpoAccesso, richiesta.body);
    const utente = await trovaUtentePerEmail(db, dati.email);
    const corretta = await verificaPassword(dati.password, utente?.password_hash ?? null);
    if (!utente || !corretta) throw new ErroreHttp(401, 'Email o password errati');
    if (!utente.attivo) throw new ErroreHttp(403, 'Questo account è stato disattivato');

    impostaCookieSessione(risposta, config, await creaSessione(db, utente.id, ora()));
    const corpo: RispostaUtente = { utente: aUtentePubblico(utente) };
    return corpo;
  });

  app.post('/api/auth/uscita', async (richiesta, risposta) => {
    const token = richiesta.cookies[COOKIE_SESSIONE];
    if (token) {
      await chiudiSessione(db, token);
      tempoReale.chiudiSessione(token);
    }
    cancellaCookieSessione(risposta, config);
    return risposta.code(204).send();
  });

  app.get('/api/auth/io', async (richiesta) => {
    const corpo: RispostaUtente = { utente: aUtentePubblico(richiediUtente(richiesta)) };
    return corpo;
  });

  app.post('/api/auth/password-dimenticata', limite(5), async (richiesta, risposta) => {
    const { email } = valida(CorpoPasswordDimenticata, richiesta.body);
    const utente = await trovaUtentePerEmail(db, email);
    if (utente?.attivo) {
      const token = await creaRecupero(db, utente.id, ora());
      const link = `${config.urlApp}/reimposta-password?token=${token}`;
      // Invio in background: il tempo di risposta non rivela se l'email esiste.
      postino
        .invia(emailRecuperoPassword(utente.email, utente.nome, link))
        .catch((errore: unknown) => richiesta.log.error(errore, 'Invio email non riuscito'));
    }
    // Stessa risposta in ogni caso: non si rivela quali email sono registrate.
    return risposta.code(202).send({
      messaggio: "Se l'email è registrata, riceverai un link per reimpostare la password.",
    });
  });

  app.post('/api/auth/reimposta-password', limite(10), async (richiesta, risposta) => {
    const dati = valida(CorpoReimpostaPassword, richiesta.body);
    const utenteId = await consumaRecupero(db, dati.token, ora());
    const utente = utenteId === null ? undefined : await trovaUtentePerId(db, utenteId);
    if (!utente) throw new ErroreHttp(400, 'Il link non è valido o è scaduto: chiedine uno nuovo');
    if (!utente.attivo) throw new ErroreHttp(403, 'Questo account è stato disattivato');

    await impostaPassword(db, utente.id, await hashPassword(dati.password));
    // La nuova password chiude ogni sessione aperta con quella vecchia.
    await chiudiSessioniUtente(db, utente.id);
    tempoReale.chiudiUtente(utente.id);
    impostaCookieSessione(risposta, config, await creaSessione(db, utente.id, ora()));
    const corpo: RispostaUtente = { utente: aUtentePubblico(utente) };
    return corpo;
  });
}
