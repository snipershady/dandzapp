import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const radiceRepository = fileURLToPath(new URL('../../../', import.meta.url));

const SchemaConfig = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string(),
  DB_NAME: z.string().min(1),
  WEB_BUILD_DIR: z.string().default(''),
  DATA_DIR: z.string().default(''),
  LIMITE_TENTATIVI: z.stringbool().default(true),
  APP_URL: z.url().default('http://localhost:5173'),
  /**
   * Server di posta come DSN: `smtp://utente:password@host:porta` (STARTTLS se offerto)
   * oppure `smtps://…` (TLS diretto, di solito porta 465). Vuoto = email solo nel log.
   * Utente e password con caratteri speciali vanno codificati (es. `@` → `%40`).
   */
  MAILER_DSN: z
    .string()
    .trim()
    .default('')
    .refine((v) => v === '' || /^smtps?:\/\/[^/\s]+(:\d+)?\/?(\?.*)?$/.test(v), {
      message: 'MAILER_DSN deve essere smtp://utente:password@host:porta o smtps://…',
    }),
  EMAIL_MITTENTE: z.string().default('Tavolo virtuale <tavolo@localhost>'),
});

export type Config = {
  ambiente: 'development' | 'test' | 'production';
  host: string;
  porta: number;
  livelloLog: string;
  db: { host: string; porta: number; utente: string; password: string; nome: string };
  /** Indirizzo pubblico dell'app, senza `/` finale: link nelle email e controllo dell'Origin. */
  urlApp: string;
  /** DSN del server di posta (MAILER_DSN); `null` = le email finiscono solo nel log. */
  mailer: string | null;
  mittente: string;
  /** Limite di richieste per IP su accesso, registrazione e recupero (disattivato solo nell'e2e). */
  limiteTentativi: boolean;
  /** Cartella della build della SPA; `null` se non esiste (es. in sviluppo con Vite). */
  cartellaWeb: string | null;
  /** File caricati sul server (immagini delle avventure): fuori dalla cartella pubblica. */
  cartellaDati: string;
};

/**
 * Legge la configurazione dalle variabili d'ambiente, completate da un file in formato
 * `.env` che non sovrascrive le variabili già impostate:
 * - quello indicato da `ENV_FILE` (in produzione `/etc/tavolo/tavolo.env`, §15.5), che
 *   deve esistere;
 * - altrimenti il `.env` alla radice del repository, se c'è (sviluppo).
 */
export function caricaConfig(env: NodeJS.ProcessEnv = process.env): Config {
  if (env === process.env) {
    const indicato = env['ENV_FILE'];
    if (indicato && !existsSync(indicato)) {
      throw new Error(`ENV_FILE=${indicato}: il file non esiste`);
    }
    const fileEnv = indicato || `${radiceRepository}.env`;
    if (existsSync(fileEnv)) process.loadEnvFile(fileEnv);
  }

  const risultato = SchemaConfig.safeParse(env);
  if (!risultato.success) {
    throw new Error(`Configurazione non valida:\n${z.prettifyError(risultato.error)}`);
  }
  const c = risultato.data;
  const cartellaWeb = c.WEB_BUILD_DIR || `${radiceRepository}apps/web/build`;

  return {
    ambiente: c.NODE_ENV,
    host: c.HOST,
    porta: c.PORT,
    livelloLog: c.LOG_LEVEL,
    db: {
      host: c.DB_HOST,
      porta: c.DB_PORT,
      utente: c.DB_USER,
      password: c.DB_PASSWORD,
      nome: c.DB_NAME,
    },
    urlApp: c.APP_URL.replace(/\/+$/, ''),
    mailer: c.MAILER_DSN || null,
    mittente: c.EMAIL_MITTENTE,
    limiteTentativi: c.LIMITE_TENTATIVI,
    cartellaDati: c.DATA_DIR || `${radiceRepository}dati`,
    cartellaWeb: existsSync(`${cartellaWeb}/index.html`) ? cartellaWeb : null,
  };
}
