import { expect, test } from '@playwright/test';
import { emailUnica } from './aiuti.ts';

test('chi non ha effettuato l’accesso viene mandato alla pagina di accesso', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/accedi$/);
  await expect(page.getByRole('heading', { name: 'Accedi' })).toBeVisible();
});

test('registrazione, uscita e nuovo accesso', async ({ page }) => {
  const email = emailUnica('irene');

  await page.goto('/registrati');
  await page.getByLabel('Nome visualizzato').fill('Irene');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('una-password-lunga');
  await page.getByRole('button', { name: 'Registrati' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Ciao Irene' })).toBeVisible();
  await expect(page.getByText('Giocatore', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Esci' }).click();
  await expect(page).toHaveURL(/\/accedi$/);

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('password-sbagliata');
  await page.getByRole('button', { name: 'Accedi' }).click();
  await expect(page.getByRole('alert')).toHaveText('Email o password errati');

  await page.getByLabel('Password').fill('una-password-lunga');
  await page.getByRole('button', { name: 'Accedi' }).click();
  await expect(page.getByRole('heading', { name: 'Ciao Irene' })).toBeVisible();
});

test('dopo l’accesso si torna alla pagina richiesta', async ({ page, request }) => {
  const email = emailUnica('fabio');
  await request.post('/api/auth/registrazione', {
    data: { email, nome: 'Fabio', password: 'una-password-lunga' },
  });

  await page.goto('/?vista=partite');
  await expect(page).toHaveURL(/\/accedi\?dopo=%2F%3Fvista%3Dpartite$/);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('una-password-lunga');
  await page.getByRole('button', { name: 'Accedi' }).click();
  await expect(page).toHaveURL(/\/\?vista=partite$/);
});

test('la registrazione mostra gli errori accanto ai campi', async ({ page }) => {
  await page.goto('/registrati');
  await page.getByLabel('Email').fill('non-una-email');
  await page.getByLabel('Password').fill('corta');
  await page.getByRole('button', { name: 'Registrati' }).click();

  await expect(page.getByText('Email non valida')).toBeVisible();
  await expect(page.getByText('La password deve avere almeno 10 caratteri')).toBeVisible();
  await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true');
});
