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
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: z.stringbool().default(false),
  SMTP_USER: z.string().default(''),
  SMTP_PASSWORD: z.string().default(''),
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
  /** `null` = nessun server SMTP: le email finiscono solo nel log. */
  smtp: { host: string; porta: number; sicuro: boolean; utente: string; password: string } | null;
  mittente: string;
  /** Limite di richieste per IP su accesso, registrazione e recupero (disattivato solo nell'e2e). */
  limiteTentativi: boolean;
  /** Cartella della build della SPA; `null` se non esiste (es. in sviluppo con Vite). */
  cartellaWeb: string | null;
  /** File caricati sul server (immagini delle avventure): fuori dalla cartella pubblica. */
  cartellaDati: string;
};

/**
 * Legge la configurazione dalle variabili d'ambiente. Il file `.env` alla radice
 * del repository, se presente, non sovrascrive le variabili già impostate.
 */
export function caricaConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const fileEnv = `${radiceRepository}.env`;
  if (env === process.env && existsSync(fileEnv)) process.loadEnvFile(fileEnv);

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
    smtp: c.SMTP_HOST
      ? {
          host: c.SMTP_HOST,
          porta: c.SMTP_PORT,
          sicuro: c.SMTP_SECURE,
          utente: c.SMTP_USER,
          password: c.SMTP_PASSWORD,
        }
      : null,
    mittente: c.EMAIL_MITTENTE,
    limiteTentativi: c.LIMITE_TENTATIVI,
    cartellaDati: c.DATA_DIR || `${radiceRepository}dati`,
    cartellaWeb: existsSync(`${cartellaWeb}/index.html`) ? cartellaWeb : null,
  };
}
