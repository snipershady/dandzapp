import { expect, test, type Browser, type Page } from '@playwright/test';
import { accedi, emailUnica, nuovoMaster, registra } from './aiuti.ts';

// RF-90: ogni modifica arriva a tutti entro 3 secondi.
const ENTRO_3_SECONDI = { timeout: 3_000 };

/** Master con una partita e una giocatrice già dentro, ognuno nel suo browser. */
async function preparaTavolo(browser: Browser, request: Parameters<typeof nuovoMaster>[0]) {
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

  const irene = await (await browser.newContext()).newPage();
  await accedi(irene, emailIrene);
  await irene.goto(link);
  await irene.getByRole('button', { name: 'Unisciti alla partita' }).click();
  await expect(
    irene.getByRole('status').filter({ hasText: 'Collegato in tempo reale' }),
  ).toBeVisible();

  return { master, irene, gestione, scheda: gestione.replace(/\/gestione$/, '') };
}

const alTavolo = (pagina: Page) => pagina.getByRole('region', { name: 'Al tavolo' });

test('presenza: chi apre e chiude la pagina compare e sparisce da "Al tavolo"', async ({
  browser,
  request,
}) => {
  const { master, irene, scheda } = await preparaTavolo(browser, request);
  await master.goto(scheda);

  await expect(alTavolo(master).getByRole('listitem', { name: 'Irene' })).toContainText(
    'gioca',
    ENTRO_3_SECONDI,
  );
  await expect(alTavolo(irene).getByRole('listitem', { name: 'Marco' })).toContainText(
    'Master',
    ENTRO_3_SECONDI,
  );

  await irene.close();
  await expect(alTavolo(master).getByRole('listitem', { name: 'Irene' })).toHaveCount(
    0,
    ENTRO_3_SECONDI,
  );
});

test('le modifiche del Master arrivano alla giocatrice senza ricaricare', async ({
  browser,
  request,
}) => {
  const { master, irene } = await preparaTavolo(browser, request);

  const nuovoPg = master.locator('details', { hasText: 'Aggiungi un personaggio' });
  await nuovoPg.getByLabel('Nome').fill('Shania');
  await nuovoPg.getByLabel('Classe').fill('Guerriera');
  await nuovoPg.getByLabel('Giocatore').selectOption({ label: 'Irene' });
  await nuovoPg.getByRole('button', { name: 'Aggiungi' }).click();

  const shania = irene
    .getByRole('region', { name: 'Personaggi' })
    .getByRole('listitem')
    .filter({ hasText: 'Shania' });
  await expect(shania).toContainText('Irene', ENTRO_3_SECONDI);
  // Il PG assegnato è anche il suo "Giochi come", visibile in "Al tavolo".
  await expect(alTavolo(irene).getByRole('listitem', { name: 'Irene' })).toContainText(
    'Shania',
    ENTRO_3_SECONDI,
  );
});

test('passando a osservatore compare subito l’avviso di sola lettura (RF-04)', async ({
  browser,
  request,
}) => {
  const { master, irene } = await preparaTavolo(browser, request);
  await expect(irene.getByText('Sola lettura.')).toHaveCount(0);

  await master.getByRole('combobox', { name: 'Ruolo di Irene' }).selectOption('osservatore');
  await expect(irene.getByRole('alert').filter({ hasText: 'Sola lettura.' })).toBeVisible(
    ENTRO_3_SECONDI,
  );
  await expect(irene.getByRole('status').filter({ hasText: 'sola lettura' })).toBeVisible();
});

test('chi viene tolto dalla partita lo vede subito', async ({ browser, request }) => {
  const { master, irene } = await preparaTavolo(browser, request);
  const riga = master
    .getByRole('region', { name: 'Partecipanti' })
    .getByRole('listitem', { name: 'Irene' });
  await riga.getByRole('button', { name: 'Togli' }).click();
  await riga.getByRole('button', { name: 'Togli' }).click();

  await expect(irene.getByRole('alert')).toContainText(
    'Il Master ti ha tolto dalla partita',
    ENTRO_3_SECONDI,
  );
});

test('senza tempo reale la pagina si riallinea da sola (RF-91)', async ({ browser, request }) => {
  const { master, irene } = await preparaTavolo(browser, request);
  // Si blocca il canale in tempo reale della giocatrice: restano solo le chiamate all'API.
  await irene.context().route('**/socket.io/**', (r) => r.abort());
  await irene.context().routeWebSocket('**/socket.io/**', (ws) => ws.close());
  await irene.reload();
  await expect(
    irene.getByRole('status').filter({ hasText: /Riconnessione|Non collegato/ }),
  ).toBeVisible();

  const nuovoPg = master.locator('details', { hasText: 'Aggiungi un personaggio' });
  await nuovoPg.getByLabel('Nome').fill('Duronin');
  await nuovoPg.getByRole('button', { name: 'Aggiungi' }).click();
  // Il ripiego interroga l'API ogni 5 secondi.
  await expect(irene.getByText('Duronin')).toBeVisible({ timeout: 8_000 });
});
