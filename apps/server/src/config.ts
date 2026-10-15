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
});

export type Config = {
  ambiente: 'development' | 'test' | 'production';
  host: string;
  porta: number;
  livelloLog: string;
  db: { host: string; porta: number; utente: string; password: string; nome: string };
  /** Cartella della build della SPA; `null` se non esiste (es. in sviluppo con Vite). */
  cartellaWeb: string | null;
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
    cartellaWeb: existsSync(`${cartellaWeb}/index.html`) ? cartellaWeb : null,
  };
}
