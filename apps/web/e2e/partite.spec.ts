import { expect, test, type Page } from '@playwright/test';
import { accedi, emailUnica, nuovoMaster, PASSWORD, registra } from './aiuti.ts';

/** Il Master crea una partita con un PG e restituisce l'indirizzo della gestione. */
async function creaPartitaConPg(page: Page, titolo: string): Promise<string> {
  await page.getByRole('link', { name: 'Nuova partita' }).click();
  await page.getByLabel('Titolo della partita').fill(titolo);
  await expect(page.getByRole('radio', { name: /Il santuario sepolto/ })).toBeChecked();
  await page.getByRole('button', { name: 'Crea la partita' }).click();
  await expect(page.getByRole('heading', { name: 'Gestisci la partita' })).toBeVisible();

  const nuovoPg = page.locator('details', { hasText: 'Aggiungi un personaggio' });
  await nuovoPg.getByLabel('Nome').fill('Shania');
  await nuovoPg.getByLabel('Classe').fill('Guerriera');
  await expect(nuovoPg.getByLabel('Sigla')).toHaveValue('Sh');
  await nuovoPg.getByRole('button', { name: 'Aggiungi' }).click();
  await expect(page.getByRole('listitem', { name: 'Shania' })).toBeVisible();
  return page.url();
}

test('dall’invito alla partita: il Master invita, la giocatrice si registra e trova il suo PG', async ({
  browser,
  request,
}) => {
  const titolo = `Santuario ${emailUnica('p').slice(2, 14)}`;
  const emailIrene = emailUnica('irene');

  // --- il Master
  const master = await (await browser.newContext()).newPage();
  await accedi(master, await nuovoMaster(request));
  await creaPartitaConPg(master, titolo);

  await master.getByLabel('Email').fill(emailIrene);
  await master.getByLabel('Personaggio').selectOption({ label: 'Shania' });
  await master.getByRole('button', { name: "Invia l'invito" }).click();
  const link = await master.getByLabel("Link d'invito").inputValue();
  expect(link).toMatch(/\/inviti\/[\w-]+$/);
  await expect(master.getByRole('listitem', { name: `Invito a ${emailIrene}` })).toBeVisible();

  // --- Irene, che non ha ancora un account
  const irene = await (await browser.newContext()).newPage();
  await irene.goto(link);
  await expect(irene.getByText(`ti invita alla partita “${titolo}”`)).toBeVisible();
  await irene.getByRole('link', { name: 'Crea un account' }).click();
  await expect(irene.getByLabel('Email')).toHaveValue(emailIrene);
  await irene.getByLabel('Nome visualizzato').fill('Irene');
  await irene.getByLabel('Password').fill(PASSWORD);
  await irene.getByRole('button', { name: 'Registrati' }).click();

  await irene.getByRole('button', { name: 'Unisciti alla partita' }).click();
  await expect(irene.getByRole('heading', { name: titolo })).toBeVisible();
  const shania = irene
    .getByRole('region', { name: 'Personaggi' })
    .getByRole('listitem')
    .filter({ hasText: 'Shania' });
  await expect(shania).toContainText('Guerriera');
  await expect(shania).toContainText('Irene');
  await expect(irene.getByText('(tu)')).toBeVisible();

  await irene.goto('/');
  await expect(irene.getByRole('link', { name: new RegExp(titolo) })).toBeVisible();

  // --- il Master vede Irene tra i partecipanti e l'invito sparisce
  await master.reload();
  await expect(master.getByRole('listitem', { name: 'Irene' })).toBeVisible();
  await expect(master.getByRole('listitem', { name: `Invito a ${emailIrene}` })).toHaveCount(0);
});

test('chi non è invitato non vede la partita, nemmeno conoscendone l’indirizzo', async ({
  browser,
  request,
}) => {
  const master = await (await browser.newContext()).newPage();
  await accedi(master, await nuovoMaster(request));
  const gestione = await creaPartitaConPg(master, 'Partita privata');
  const scheda = gestione.replace(/\/gestione$/, '');

  const emailEstraneo = emailUnica('estraneo');
  const estraneo = await (await browser.newContext()).newPage();
  await registra(request, { email: emailEstraneo, nome: 'Estraneo' });
  await accedi(estraneo, emailEstraneo);
  await expect(estraneo.getByText('Partita privata')).toHaveCount(0);

  await estraneo.goto(scheda);
  await expect(estraneo.getByRole('heading', { name: 'Pagina non trovata' })).toBeVisible();
  await estraneo.goto(gestione);
  await expect(estraneo.getByRole('heading', { name: 'Pagina non trovata' })).toBeVisible();
});

test('un invito aperto con un altro account non si può accettare', async ({ browser, request }) => {
  const master = await (await browser.newContext()).newPage();
  await accedi(master, await nuovoMaster(request));
  await creaPartitaConPg(master, 'Partita con invito');
  await master.getByLabel('Email').fill(emailUnica('irene'));
  await master.getByRole('button', { name: "Invia l'invito" }).click();
  const link = await master.getByLabel("Link d'invito").inputValue();

  const emailFabio = emailUnica('fabio');
  const fabio = await (await browser.newContext()).newPage();
  await registra(request, { email: emailFabio, nome: 'Fabio' });
  await accedi(fabio, emailFabio);
  await fabio.goto(link);
  await expect(fabio.getByRole('alert')).toContainText(
    `Hai effettuato l'accesso come ${emailFabio}`,
  );
  await expect(fabio.getByRole('button', { name: 'Unisciti alla partita' })).toHaveCount(0);
});

test('il Master archivia ed elimina una partita con conferma nella pagina', async ({
  page,
  request,
}) => {
  await accedi(page, await nuovoMaster(request));
  await creaPartitaConPg(page, 'Da eliminare');

  const impostazioni = page.getByRole('region', { name: 'Impostazioni' });
  await impostazioni.getByRole('button', { name: 'Archivia' }).click();
  await impostazioni.getByRole('button', { name: 'Conferma' }).click();
  await expect(impostazioni.getByText('La partita è archiviata.')).toBeVisible();

  await impostazioni.getByRole('button', { name: 'Elimina la partita' }).click();
  await impostazioni.getByRole('button', { name: 'Elimina', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Le mie partite' })).toBeVisible();
  await expect(page.getByText('Da eliminare')).toHaveCount(0);
});
