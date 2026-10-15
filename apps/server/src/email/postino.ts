import type { FastifyBaseLogger } from 'fastify';
import { createTransport } from 'nodemailer';
import type { Config } from '../config.ts';

export type Email = { a: string; oggetto: string; testo: string };

/** Invio delle email: SMTP in produzione, log in sviluppo, finto nei test. */
export type Postino = { invia(email: Email): Promise<void> };

export function creaPostino(config: Config, log: FastifyBaseLogger): Postino {
  const smtp = config.smtp;
  if (!smtp) {
    return {
      async invia(email) {
        log.info({ email }, 'Email non inviata (SMTP non configurato)');
      },
    };
  }
  const trasporto = createTransport({
    host: smtp.host,
    port: smtp.porta,
    secure: smtp.sicuro,
    ...(smtp.utente ? { auth: { user: smtp.utente, pass: smtp.password } } : {}),
  });
  return {
    async invia(email) {
      await trasporto.sendMail({
        from: config.mittente,
        to: email.a,
        subject: email.oggetto,
        text: email.testo,
      });
    },
  };
}
