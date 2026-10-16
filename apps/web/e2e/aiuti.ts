import { expect, type APIRequestContext, type Browser, type Page } from '@playwright/test';
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

// RF-90: ogni modifica arriva a tutti entro 3 secondi.
export const ENTRO_3_SECONDI = { timeout: 3_000 };

/**
 * Master con una partita e una giocatrice già dentro, ognuno nel suo browser. La giocatrice
 * può usare la pagina del progetto (es. il telefono emulato) invece di un browser nuovo.
 */
export async function preparaTavolo(
  browser: Browser,
  request: APIRequestContext,
  paginaIrene?: Page,
) {
  const master = await (await browser.newContext()).newPage();
  await accedi(master, await nuovoMaster(request));
  await master.getByRole('link', { name: 'Nuova partita' }).click();
  await master.getByLabel('Titolo della partita').fill(`Tavolo ${emailUnica('t').slice(2, 12)}`);
  await master.getByRole('button', { name: 'Crea la partita' }).click();
  await expect(master.getByRole('heading', { name: 'Gestisci la partita' })).toBeVisible();
  const gestione = master.url();

  const emailIrene = emailUnica('irene');
  await registra(request, { email: emailIrene, nome: 'Irene' });
  await master.getByLabel('Email').fill(emailIrene);
  await master.getByRole('button', { name: "Invia l'invito" }).click();
  const link = await master.getByLabel("Link d'invito").inputValue();

  const irene = paginaIrene ?? (await (await browser.newContext()).newPage());
  await accedi(irene, emailIrene);
  await irene.goto(link);
  await irene.getByRole('button', { name: 'Unisciti alla partita' }).click();
  await expect(
    irene.getByRole('status').filter({ hasText: 'Collegato in tempo reale' }),
  ).toBeVisible();

  return { master, irene, gestione, scheda: gestione.replace(/\/gestione$/, '') };
}
