import { expect, test } from '@playwright/test';
import { accedi, emailUnica, promuoviMaster, registra } from './aiuti.ts';

test('un giocatore non vede il pannello Utenti e non può aprirlo', async ({ page, request }) => {
  const email = emailUnica('giocatore');
  await registra(request, { email, nome: 'Giocatore' });
  await accedi(page, email);

  await expect(page.getByRole('link', { name: 'Utenti' })).toHaveCount(0);
  await page.goto('/amministrazione');
  await expect(page.getByRole('heading', { name: 'Accesso non consentito' })).toBeVisible();
});

test('il Master promuove e disattiva un utente con conferma nella pagina', async ({
  page,
  request,
}) => {
  const emailMaster = emailUnica('master');
  const emailIrene = emailUnica('irene');
  const nomeIrene = `Irene ${emailIrene.slice(6, 19)}`;
  await registra(request, { email: emailMaster, nome: 'Master' });
  await registra(request, { email: emailIrene, nome: nomeIrene });
  await promuoviMaster(emailMaster);

  await accedi(page, emailMaster);
  await page.getByRole('link', { name: 'Utenti' }).click();
  await expect(page.getByRole('heading', { name: 'Utenti' })).toBeVisible();

  await page.getByLabel('Cerca per nome o email').fill(emailIrene);
  const riga = page.getByRole('listitem', { name: nomeIrene });
  await expect(riga).toBeVisible();
  await expect(riga.getByText('Giocatore', { exact: true })).toBeVisible();

  // Promozione: serve la conferma, e Annulla non cambia nulla.
  await riga.getByRole('button', { name: 'Rendi Master' }).click();
  await riga.getByRole('button', { name: 'Annulla' }).click();
  await expect(riga.getByText('Giocatore', { exact: true })).toBeVisible();

  await riga.getByRole('button', { name: 'Rendi Master' }).click();
  await expect(riga.getByText(`Rendi Master ${nomeIrene}?`)).toBeVisible();
  await riga.getByRole('button', { name: 'Conferma' }).click();
  await expect(riga.getByText('Master', { exact: true })).toBeVisible();

  await riga.getByRole('button', { name: 'Disattiva' }).click();
  await riga.getByRole('button', { name: 'Conferma' }).click();
  await expect(riga.getByText('Disattivato')).toBeVisible();
  await expect(riga.getByRole('button', { name: 'Riattiva' })).toBeVisible();
});

test('il Master non può modificare il proprio account', async ({ page, request }) => {
  const email = emailUnica('master');
  await registra(request, { email, nome: 'Unico' });
  await promuoviMaster(email);
  await accedi(page, email);

  await page.goto('/amministrazione');
  await page.getByLabel('Cerca per nome o email').fill(email);
  const riga = page.getByRole('listitem', { name: 'Unico' });
  await expect(riga.getByText('Sei tu')).toBeVisible();
  await expect(riga.getByRole('button')).toHaveCount(0);
});
