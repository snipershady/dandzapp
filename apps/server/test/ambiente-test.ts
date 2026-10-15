import { existsSync } from 'node:fs';

/**
 * Variabili d'ambiente per Vitest e Playwright: il server usa il database di test
 * (DB_TEST_*) al posto di quello di sviluppo. Il database di test viene svuotato
 * dai test, per questo il suo nome deve finire con `_test`.
 */
export function ambienteTest(): Record<string, string> {
  const fileEnv = new URL('../../../.env', import.meta.url);
  if (existsSync(fileEnv)) process.loadEnvFile(fileEnv);
  const e = process.env;

  const nome = e['DB_TEST_NAME'] ?? 'dandzapp_test';
  if (!nome.endsWith('_test')) {
    throw new Error(`DB_TEST_NAME="${nome}" deve finire con _test: i test ne cancellano i dati.`);
  }
  return {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DB_HOST: e['DB_TEST_HOST'] ?? '127.0.0.1',
    DB_PORT: e['DB_TEST_PORT'] ?? '3306',
    DB_USER: e['DB_TEST_USER'] ?? 'dandzapp_test',
    DB_PASSWORD: e['DB_TEST_PASSWORD'] ?? '',
    DB_NAME: nome,
    SMTP_HOST: '',
  };
}
