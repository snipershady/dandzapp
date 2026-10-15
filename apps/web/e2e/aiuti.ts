import type { APIRequestContext, Page } from '@playwright/test';
import { ambienteTest } from '../../server/test/ambiente-test.ts';
import { creaDatabase } from '../../server/src/db/database.ts';
import { creaOPromuoviMaster } from '../../server/src/utenti/master.ts';

export const PASSWORD = 'una-password-lunga';

/** Email diversa per ogni esecuzione e progetto: il database di test non viene svuotato qui. */
export const emailUnica = (nome: string) =>
  `${nome}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@esempio.it`;

export async function registra(
  request: APIRequestContext,
  dati: { email: string; nome: string },
): Promise<void> {
  const r = await request.post('/api/auth/registrazione', {
    data: { ...dati, password: PASSWORD },
  });
  if (r.status() !== 201) throw new Error(`Registrazione fallita: ${await r.text()}`);
}

/** Promuove a Master direttamente sul database di test (come `utente:crea-master`). */
export async function promuoviMaster(email: string): Promise<void> {
  const env = ambienteTest();
  const db = creaDatabase({
    host: env['DB_HOST'] ?? '',
    porta: Number(env['DB_PORT']),
    utente: env['DB_USER'] ?? '',
    password: env['DB_PASSWORD'] ?? '',
    nome: env['DB_NAME'] ?? '',
  });
  try {
    await creaOPromuoviMaster(db, { email, nome: '' });
  } finally {
    await db.destroy();
  }
}

/** Registra un Master e restituisce la sua email. */
export async function nuovoMaster(request: APIRequestContext, nome = 'Marco'): Promise<string> {
  const email = emailUnica('master');
  await registra(request, { email, nome });
  await promuoviMaster(email);
  return email;
}

export async function accedi(page: Page, email: string): Promise<void> {
  await page.goto('/accedi');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Accedi' }).click();
  await page.waitForURL((url) => url.pathname === '/');
}
