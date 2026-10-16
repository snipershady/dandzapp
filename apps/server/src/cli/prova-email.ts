/**
 * Spedisce un'email di prova con il server di posta di MAILER_DSN, per verificare la
 * configurazione (in sviluppo, in staging e in produzione).
 *
 * Uso: npm run email:prova -- tuo@indirizzo.it
 */
import pino from 'pino';
import { z } from 'zod';
import { caricaConfig } from '../config.ts';
import { creaPostino, dsnSenzaPassword } from '../email/postino.ts';

const destinatario = z.email().safeParse(process.argv[2]?.trim().toLowerCase());
if (!destinatario.success) {
  console.error('Uso: npm run email:prova -- tuo@indirizzo.it');
  process.exit(2);
}

const config = caricaConfig();
if (!config.mailer) {
  console.error(
    '✘ MAILER_DSN è vuoto: le email finirebbero solo nel log. Impostalo nel file .env.',
  );
  process.exit(1);
}
console.log(`Invio con ${dsnSenzaPassword(config.mailer)} a ${destinatario.data}…`);
try {
  await creaPostino(config, pino({ level: 'warn' })).invia({
    a: destinatario.data,
    oggetto: 'Tavolo virtuale: email di prova',
    testo: `Se leggi questo messaggio, la posta del Tavolo virtuale funziona.\n\n${config.urlApp}\n`,
  });
  console.log('✔ Email inviata.');
} catch (e) {
  console.error(`✘ Invio non riuscito: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}
