import { expect, test } from '@playwright/test';

test('il server e il database rispondono', async ({ request }) => {
  const risposta = await request.get('/api/salute');
  expect(risposta.status()).toBe(200);
  expect(await risposta.json()).toMatchObject({ stato: 'ok', database: 'ok' });
});

test('una rotta della SPA ricaricata direttamente non dà 404', async ({ page }) => {
  const risposta = await page.goto('/partite/42');
  expect(risposta?.status()).toBe(200);
});
