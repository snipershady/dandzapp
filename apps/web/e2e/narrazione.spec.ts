import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { ENTRO_3_SECONDI, preparaTavolo } from './aiuti.ts';

test('il Master pubblica un testo e la giocatrice lo legge entro 3 secondi (RF-70)', async ({
  browser,
  request,
  page,
}) => {
  const { master, irene, scheda } = await preparaTavolo(browser, request, page);
  await master.goto(scheda);
  const pannello = master.getByRole('region', { name: 'Narrazione' });
  const legge = irene.getByRole('region', { name: 'Il Master legge' });
  await expect(legge).toHaveCount(0);

  // Un testo con dei tag appare letteralmente, mai come HTML (RNF-06).
  const testo = 'La porta si apre con un <b>cigolio</b>.\nDentro, il buio.';
  await pannello.getByLabel('Testo da leggere ai giocatori').fill(testo);
  await pannello.getByRole('button', { name: 'Pubblica' }).click();
  await expect(legge).toBeVisible(ENTRO_3_SECONDI);
  await expect(legge.locator('p')).toHaveText(testo);
  await expect(legge.locator('b')).toHaveCount(0);

  await pannello.getByRole('button', { name: 'Nascondi' }).click();
  await expect(legge).toHaveCount(0, ENTRO_3_SECONDI);

  // Il testo resta nello storico del Master e si può ripubblicare.
  await pannello.getByRole('button', { name: 'Ripubblica' }).click();
  await expect(legge.locator('p')).toHaveText(testo, ENTRO_3_SECONDI);
});

test('il Master esporta la partita in JSON (RF-95)', async ({ browser, request }) => {
  const { master, gestione } = await preparaTavolo(browser, request);
  await master.goto(gestione);
  const [scaricato] = await Promise.all([
    master.waitForEvent('download'),
    master.getByRole('link', { name: 'Esporta (JSON)' }).click(),
  ]);
  expect(scaricato.suggestedFilename()).toMatch(/^partita-\d+-\d{4}-\d{2}-\d{2}\.json$/);
  const backup = JSON.parse(await readFile((await scaricato.path()) ?? '', 'utf8'));
  expect(backup).toMatchObject({ formato: 1, zoneScoperte: ['ingresso'] });
  expect(backup.partecipanti).toEqual([expect.objectContaining({ nome: 'Irene' })]);
});
