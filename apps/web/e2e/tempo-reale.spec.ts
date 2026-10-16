import { expect, test, type Page } from '@playwright/test';
import { ENTRO_3_SECONDI, preparaTavolo } from './aiuti.ts';

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
  await expect(irene.getByRole('region', { name: 'Personaggi' }).getByText('Duronin')).toBeVisible({
    timeout: 8_000,
  });
});
