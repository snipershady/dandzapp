import { expect, test } from '@playwright/test';

test('la pagina iniziale si collega al server', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Tavolo virtuale' })).toBeVisible();
  // Solo se anche il database risponde: altrimenti il testo è "Server collegato, database non raggiungibile."
  await expect(
    page.getByRole('status').getByText('Server collegato', { exact: true }),
  ).toBeVisible();
});

test('una rotta della SPA ricaricata direttamente non dà 404', async ({ page }) => {
  const risposta = await page.goto('/partite/42');
  expect(risposta?.status()).toBe(200);
});
