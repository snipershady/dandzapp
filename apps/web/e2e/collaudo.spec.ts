import { devices, expect, test, type Browser, type Page } from '@playwright/test';
import sharp from 'sharp';
import { io as ioClient } from 'socket.io-client';
import { accedi, emailUnica, ENTRO_3_SECONDI, nuovoMaster, PASSWORD, registra } from './aiuti.ts';

/**
 * Collaudo dell'MVP: un test per ogni criterio della §12 di CLAUDE.md, giocato con più
 * browser insieme. Il Master e Irene sono al computer, Fabio è al telefono, e c'è un
 * utente che non è stato invitato. Irene gioca in entrambe le partite, Fabio solo nella
 * prima.
 *
 * I test sono in sequenza e condividono lo stato: ognuno riprende da dove si è fermato
 * il precedente, come in una serata di gioco.
 */

test.describe.configure({ mode: 'serial' });
// Il telefono di Fabio è emulato qui dentro: basta il progetto desktop.
test.skip(() => test.info().project.name !== 'desktop');

type Persona = { pagina: Page; email: string };
let master: Persona;
let irene: Persona;
let fabio: Persona;
let estraneo: Persona;
let partitaA: string;
let partitaB: string;

async function nuovaPersona(browser: Browser, telefono = false): Promise<Page> {
  const contesto = await browser.newContext(telefono ? { ...devices['Pixel 7'] } : {});
  return contesto.newPage();
}

/** Il Master crea una partita e restituisce l'indirizzo della sua scheda. */
async function creaPartita(titolo: string): Promise<string> {
  const p = master.pagina;
  await p.goto('/');
  await p.getByRole('link', { name: 'Nuova partita' }).click();
  await p.getByLabel('Titolo della partita').fill(titolo);
  await p.getByRole('button', { name: 'Crea la partita' }).click();
  await expect(p.getByRole('heading', { name: 'Gestisci la partita' })).toBeVisible();
  return p.url().replace(/\/gestione$/, '');
}

/** Il Master invita qualcuno (con un PG nuovo) e l'invitato accetta. */
async function invita(scheda: string, chi: Persona, nome: string, pg: string): Promise<void> {
  const p = master.pagina;
  await p.goto(`${scheda}/gestione`);
  const nuovoPg = p.locator('details', { hasText: 'Aggiungi un personaggio' });
  await nuovoPg.evaluate((d) => ((d as HTMLDetailsElement).open = true));
  await nuovoPg.getByLabel('Nome').fill(pg);
  await nuovoPg.getByRole('button', { name: 'Aggiungi' }).click();
  await expect(p.getByRole('listitem', { name: pg })).toBeVisible();
  await p.getByLabel('Email').fill(chi.email);
  await p.getByLabel('Personaggio').selectOption({ label: pg });
  await p.getByRole('button', { name: "Invia l'invito" }).click();
  const link = await p.getByLabel("Link d'invito").inputValue();
  await chi.pagina.goto(link);
  await chi.pagina.getByRole('button', { name: 'Unisciti alla partita' }).click();
  await expect(chi.pagina.getByRole('heading', { name: nome, exact: false })).toBeVisible();
}

const regione = (p: Page, nome: string) => p.getByRole('region', { name: nome });
const pixel = async (png: Buffer, x: number, y: number) => {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * 4;
  return [...data.subarray(i, i + 4)];
};

test.beforeAll(async ({ browser, request }) => {
  master = { pagina: await nuovaPersona(browser), email: await nuovoMaster(request) };
  irene = { pagina: await nuovaPersona(browser), email: emailUnica('irene') };
  fabio = { pagina: await nuovaPersona(browser, true), email: emailUnica('fabio') };
  estraneo = { pagina: await nuovaPersona(browser), email: emailUnica('estraneo') };
  await accedi(master.pagina, master.email);
  for (const [p, nome] of [
    [irene, 'Irene'],
    [estraneo, 'Estraneo'],
  ] as const) {
    await registra(request, { email: p.email, nome });
    await accedi(p.pagina, p.email);
  }
});

test.afterAll(async () => {
  for (const p of [master, irene, fabio, estraneo]) await p?.pagina.context().close();
});

test('§12.1 un nuovo utente si registra, accede ed esce; chi si registra è ROLE_PLAYER', async () => {
  const p = fabio.pagina;
  await p.goto('/registrati');
  await p.getByLabel('Nome visualizzato').fill('Fabio');
  await p.getByLabel('Email').fill(fabio.email);
  await p.getByLabel('Password').fill(PASSWORD);
  await p.getByRole('button', { name: 'Registrati' }).click();
  await expect(p.getByRole('heading', { name: 'Le mie partite' })).toBeVisible();
  await expect(p.getByText('Giocatore', { exact: true })).toBeVisible();
  await p.getByRole('button', { name: 'Esci' }).click();
  await expect(p).toHaveURL(/\/accedi$/);
  await accedi(p, fabio.email);
});

test('§12.2 il Master crea due partite e invita giocatori diversi, uno in comune', async () => {
  partitaA = await creaPartita('Collaudo A');
  partitaB = await creaPartita('Collaudo B');
  await invita(partitaA, irene, 'Collaudo A', 'Shania');
  await invita(partitaA, fabio, 'Collaudo A', 'Duronin');
  await invita(partitaB, irene, 'Collaudo B', 'Gilmares');
});

test('§12.3 Irene vede entrambe le partite; chi non è invitato non ne vede nessuna', async () => {
  await irene.pagina.goto('/');
  await expect(irene.pagina.getByRole('link', { name: /Collaudo A/ })).toBeVisible();
  await expect(irene.pagina.getByRole('link', { name: /Collaudo B/ })).toBeVisible();
  await fabio.pagina.goto('/');
  await expect(fabio.pagina.getByRole('link', { name: /Collaudo B/ })).toHaveCount(0);

  const e = estraneo.pagina;
  await e.goto('/');
  await expect(e.getByRole('link', { name: /Collaudo/ })).toHaveCount(0);
  for (const url of [partitaA, partitaB, `${partitaA}/gestione`]) {
    await e.goto(url);
    await expect(e.getByRole('heading', { name: 'Pagina non trovata' })).toBeVisible();
  }
  const id = partitaA.split('/').at(-1);
  for (const api of [`/api/partite/${id}`, `/api/partite/${id}/mappa`]) {
    expect((await e.request.get(api)).status()).toBe(404);
  }
});

test('§12.5 un ROLE_PLAYER non crea partite né fa azioni da Master, neanche a mano', async () => {
  const p = irene.pagina;
  await p.goto('/');
  await expect(p.getByRole('link', { name: 'Nuova partita' })).toHaveCount(0);
  const r = await p.request.post('/api/partite', {
    data: { titolo: 'Abusiva', avventura: 'sessione-0' },
    headers: { origin: new URL(p.url()).origin },
  });
  expect(r.status()).toBe(403);

  // Comandi del Master costruiti a mano e spediti sul canale in tempo reale, con la
  // sessione di Irene: il server li deve rifiutare tutti.
  const origine = new URL(p.url()).origin;
  const cookie = (await p.context().cookies())
    .filter((c) => c.name === 'sessione')
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
  const s = ioClient(origine, {
    path: '/socket.io',
    transports: ['websocket'],
    extraHeaders: { cookie, origin: origine },
    reconnection: false,
  });
  const emetti = (evento: string, ...dati: unknown[]) =>
    new Promise<unknown>((ok) => s.emit(evento, ...dati, ok));
  try {
    expect(await emetti('partita:entra', Number(partitaA.split('/').at(-1)))).toMatchObject({
      ok: true,
    });
    const vietato = { ok: false, errore: 'Solo il Master della partita può farlo' };
    expect(await emetti('zona:imposta', { zonaId: 'sala3', scoperta: true })).toEqual(vietato);
    expect(
      await emetti('mostri:aggiungi', { tipo: 'St', quantita: 1, zonaId: 'ingresso' }),
    ).toEqual(vietato);
    expect(await emetti('narrazione:pubblica', { testo: 'falso' })).toEqual(vietato);
    expect(await emetti('pedine:riporta')).toEqual(vietato);
    expect(await emetti('tiri:svuota')).toEqual(vietato);
    expect(
      await emetti('dadi:tira', { facce: 20, numero: 1, modificatore: 0, nascosto: true }),
    ).toEqual({ ok: false, errore: 'Solo il Master può tirare di nascosto' });
  } finally {
    s.disconnect();
  }
});

test('§12.6 ogni giocatore entra dall’invito e compare in "Al tavolo" come "gioca"', async () => {
  await master.pagina.goto(partitaA);
  await irene.pagina.goto(partitaA);
  await fabio.pagina.goto(partitaA);
  const alTavolo = regione(master.pagina, 'Al tavolo');
  await expect(alTavolo.getByRole('listitem', { name: 'Irene' })).toContainText(
    'gioca',
    ENTRO_3_SECONDI,
  );
  await expect(alTavolo.getByRole('listitem', { name: 'Fabio' })).toContainText(
    'gioca',
    ENTRO_3_SECONDI,
  );
});

test('§12.8 il Master scopre una zona e tutti la vedono entro 3 secondi', async () => {
  const href = (p: Page) =>
    p.getByRole('group', { name: 'Mappa del dungeon' }).locator('image').getAttribute('href');
  const [primaIrene, primaFabio] = [await href(irene.pagina), await href(fabio.pagina)];
  await regione(master.pagina, 'Zone')
    .getByRole('checkbox', { name: "1 · Sala d'ingresso" })
    .check();
  await expect.poll(() => href(irene.pagina), ENTRO_3_SECONDI).not.toBe(primaIrene);
  await expect.poll(() => href(fabio.pagina), ENTRO_3_SECONDI).not.toBe(primaFabio);
});

test('§12.9 un giocatore sposta una pedina e tutti la vedono spostata entro 3 secondi', async () => {
  const p = irene.pagina;
  const sua = p.locator('[data-pedina="Sh"]');
  await sua.scrollIntoViewIfNeeded();
  const box = await sua.boundingBox();
  const mappa = await p.getByRole('group', { name: 'Mappa del dungeon' }).boundingBox();
  if (!box || !mappa) throw new Error('mappa non visibile');
  const scala = mappa.width / 1480;
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.down();
  await p.mouse.move(mappa.x + 560 * scala, mappa.y + 600 * scala, { steps: 8 });
  await p.mouse.up();
  for (const altro of [master.pagina, fabio.pagina]) {
    await expect(altro.locator('[data-pedina="Sh"]')).toHaveAttribute(
      'transform',
      /translate\(5[56]\d(\.\d+)? (59\d|60\d)(\.\d+)?\)/,
      ENTRO_3_SECONDI,
    );
  }
});

test('§12.10 un tiro compare nello storico di tutti con nome, formula, risultati e totale', async () => {
  const dadi = regione(fabio.pagina, 'Dadi');
  await dadi.getByLabel('Modificatore').fill('1');
  await dadi.getByLabel('Motivo').fill('attacco');
  await dadi.getByRole('button', { name: 'd8' }).click();
  const totale = await dadi.locator('[data-totale]').textContent();
  for (const p of [master.pagina, irene.pagina]) {
    const riga = regione(p, 'Storico dei tiri').getByRole('listitem').first();
    await expect(riga).toContainText('Duronin', ENTRO_3_SECONDI);
    await expect(riga).toContainText('Fabio');
    await expect(riga).toContainText('attacco');
    await expect(riga).toContainText('1d8+1');
    await expect(riga).toContainText(/\[\d\]/);
    await expect(riga).toContainText(`→ ${totale}`);
  }
});

test('§12.11 un tiro nascosto del Master non compare ai giocatori', async () => {
  const dadi = regione(master.pagina, 'Dadi');
  await dadi.getByLabel('Motivo').fill('segreto');
  await dadi.getByLabel('Tiro nascosto').check();
  await dadi.getByRole('button', { name: 'd20' }).click();
  await expect(regione(master.pagina, 'Storico dei tiri')).toContainText(
    'segreto',
    ENTRO_3_SECONDI,
  );
  await irene.pagina.waitForTimeout(1500);
  await expect(regione(irene.pagina, 'Storico dei tiri')).not.toContainText('segreto');
  const id = partitaA.split('/').at(-1);
  expect(await (await irene.pagina.request.get(`/api/partite/${id}`)).text()).not.toContain(
    'segreto',
  );
});

test('§12.12 un mostro in una zona coperta non si vede né arriva nei dati, finché la zona è coperta', async () => {
  const mostri = regione(master.pagina, 'Mostri');
  await mostri.getByLabel('Tipo').selectOption({ label: 'Spettro' });
  await mostri
    .getByLabel('Zona di comparsa')
    .selectOption({ label: '3 · Sacrario del falco (coperta)' });
  await mostri.getByRole('button', { name: 'Aggiungi' }).click();
  await expect(master.pagina.locator('[data-mostro="Sp1"]')).toBeVisible(ENTRO_3_SECONDI);
  await irene.pagina.waitForTimeout(1000);
  await expect(irene.pagina.locator('[data-mostro]')).toHaveCount(0);
  const id = partitaA.split('/').at(-1);
  const dati = await (await irene.pagina.request.get(`/api/partite/${id}`)).json();
  expect(dati.mostri).toEqual([]);

  await regione(master.pagina, 'Zone')
    .getByRole('checkbox', { name: '3 · Sacrario del falco' })
    .check();
  await expect(irene.pagina.locator('[data-mostro="Sp1"]')).toBeVisible(ENTRO_3_SECONDI);
});

test('§12.13 il passaggio segreto compare solo dopo che il Master scopre la sua zona', async () => {
  const id = partitaA.split('/').at(-1);
  // Un punto della parete del passaggio: nella mappa dei giocatori è trasparente finché
  // la zona è coperta, nero (il ritaglio del segreto) quando è scoperta.
  const segreto = async () =>
    pixel(
      Buffer.from(await (await irene.pagina.request.get(`/api/partite/${id}/mappa`)).body()),
      620,
      188,
    );
  expect((await segreto())[3]).toBe(0);
  await regione(master.pagina, 'Zone').getByRole('checkbox', { name: 'Passaggio segreto' }).check();
  await expect
    .poll(async () => (await segreto()).slice(0, 3), ENTRO_3_SECONDI)
    .toEqual([17, 17, 17]);
});

test('§12.4 quello che succede in una partita non compare nell’altra', async () => {
  const p = irene.pagina;
  await p.goto(partitaB);
  await expect(regione(p, 'Storico dei tiri')).toContainText('Ancora nessun tiro.');
  await expect(p.locator('[data-mostro]')).toHaveCount(0);
  await expect(p.locator('[data-pedina="Sh"]')).toHaveCount(0);
  await expect(p.locator('[data-pedina="Gi"]')).toBeVisible();
  const id = partitaB.split('/').at(-1);
  const dati = await (await p.request.get(`/api/partite/${id}`)).json();
  expect(dati.tiri).toEqual([]);
  expect(dati.mostri).toEqual([]);
});

test('§12.7 chi non può giocare vede l’avviso di sola lettura', async () => {
  await master.pagina.goto(`${partitaA}/gestione`);
  await fabio.pagina.goto(partitaA);
  await master.pagina.getByRole('combobox', { name: 'Ruolo di Fabio' }).selectOption('osservatore');
  await expect(fabio.pagina.getByRole('alert').filter({ hasText: 'Sola lettura.' })).toBeVisible(
    ENTRO_3_SECONDI,
  );
  await expect(regione(fabio.pagina, 'Dadi')).toHaveCount(0);
  await master.pagina.getByRole('combobox', { name: 'Ruolo di Fabio' }).selectOption('giocatore');
});

test('§12.14 chiudendo e riaprendo la pagina (anche da un altro browser) lo stato è identico', async ({
  browser,
}) => {
  const id = partitaA.split('/').at(-1);
  const stato = async (p: Page) => {
    const d = await (await p.request.get(`/api/partite/${id}`)).json();
    return {
      mappa: d.mappa,
      personaggi: d.personaggi,
      mostri: d.mostri,
      tiri: d.tiri,
      narrazione: d.narrazione,
    };
  };
  const prima = await stato(irene.pagina);
  await irene.pagina.context().close();

  // Il "giorno dopo": un browser nuovo, un nuovo accesso.
  irene.pagina = await nuovaPersona(browser);
  await accedi(irene.pagina, irene.email);
  await irene.pagina.goto(partitaA);
  await expect(irene.pagina.locator('[data-pedina="Sh"]')).toBeVisible();
  expect(await stato(irene.pagina)).toEqual(prima);
});

test('§12.15 la pagina è utilizzabile da telefono', async () => {
  const p = fabio.pagina;
  await p.goto(partitaA);
  expect(p.viewportSize()?.width).toBeLessThan(500);
  await expect(p.getByRole('group', { name: 'Mappa del dungeon' })).toBeVisible();
  // Tornato giocatore dopo il §12.7, Fabio sceglie di nuovo il suo PG (RF-03).
  await p.getByLabel('Giochi come').selectOption({ label: 'Duronin' });
  const dadi = regione(p, 'Dadi');
  await expect(dadi.getByRole('button', { name: 'd20' })).toBeEnabled(ENTRO_3_SECONDI);
  await dadi.getByRole('button', { name: 'd20' }).tap();
  await expect(dadi.locator('[data-totale]')).toBeVisible(ENTRO_3_SECONDI);
  const eccesso = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(eccesso).toBeLessThanOrEqual(0);
});
