import type { FastifyBaseLogger } from 'fastify';
import { createTransport } from 'nodemailer';
import type { Config } from '../config.ts';

export type Email = { a: string; oggetto: string; testo: string };

/** Invio delle email: SMTP in produzione, log in sviluppo, finto nei test. */
export type Postino = { invia(email: Email): Promise<void> };

/** Il DSN senza la password, da mostrare nei log e nei messaggi. */
export function dsnSenzaPassword(dsn: string): string {
  const url = new URL(dsn);
  if (url.password) url.password = '***';
  return url.toString();
}

export function creaPostino(config: Config, log: FastifyBaseLogger): Postino {
  const dsn = config.mailer;
  if (!dsn) {
    return {
      async invia(email) {
        log.info({ email }, 'Email non inviata (MAILER_DSN non configurato)');
      },
    };
  }
  // Nodemailer accetta direttamente l'URL: smtp:// (con STARTTLS) o smtps:// (TLS).
  const trasporto = createTransport(dsn);
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
