import { expect, test } from '@playwright/test';

/**
 * Nessun file riservato è raggiungibile conoscendone l'indirizzo (§9, §15.2): le immagini
 * delle avventure passano solo dall'API, che controlla partecipazione e nebbia; la mappa
 * del Master e i file di configurazione non sono mai serviti.
 */
test('i file delle avventure, la mappa del Master e la configurazione non sono serviti', async ({
  request,
}) => {
  for (const url of [
    '/dati/avventure/sessione-0/mappa_giocatori.png',
    '/avventure/sessione-0/mappa_giocatori.png',
    '/avventure/sessione-0/segreti/passaggio.png',
    '/avventure/sessione-0/master/mappa_master.png',
    '/avventure/sessione-0/dungeon.json',
    '/segreti/passaggio.png',
    '/.env',
    '/../.env',
    '/%2e%2e/.env',
    '/package.json',
    '/apps/server/src/config.ts',
  ]) {
    const r = await request.get(url);
    // Le rotte sconosciute ricevono la pagina della SPA (che mostrerà "non trovata"),
    // mai il file richiesto.
    const tipo = r.headers()['content-type'] ?? '';
    expect(tipo, url).not.toMatch(/image|json|javascript|octet-stream/);
    const corpo = await r.text();
    expect(corpo, url).not.toMatch(/DB_PASSWORD|MAILER_DSN|"formato"|import /);
  }
});

test('le API rispondono 401 senza accesso', async ({ request }) => {
  for (const url of [
    '/api/partite',
    '/api/partite/1',
    '/api/partite/1/mappa',
    '/api/partite/1/backup',
  ]) {
    expect((await request.get(url)).status(), url).toBe(401);
  }
});
