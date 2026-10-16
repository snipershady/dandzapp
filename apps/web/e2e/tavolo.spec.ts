import { expect, test, type Locator, type Page } from '@playwright/test';
import { ENTRO_3_SECONDI, preparaTavolo } from './aiuti.ts';

// Sessione 0: mappa di 1480 px di larghezza, primo posto di partenza in fondo alla scala.
const LARGHEZZA_MAPPA = 1480;
const PRIMO_POSTO = { x: 460, y: 880 };
// Un punto della Sala d'ingresso, dove la giocatrice porta la pedina.
const DESTINAZIONE = { x: 560, y: 600 };

const pedina = (pagina: Page, sigla: string) => pagina.locator(`[data-pedina="${sigla}"]`);

/** Posizione di una pedina in coordinate della mappa, letta dal suo `transform`. */
async function posizione(p: Locator): Promise<{ x: number; y: number }> {
  const t = (await p.getAttribute('transform')) ?? '';
  const [x, y] = (/translate\(([\d.]+) ([\d.]+)\)/.exec(t) ?? []).slice(1).map(Number);
  return { x: x ?? NaN, y: y ?? NaN };
}

async function vicinaA(p: Locator, atteso: { x: number; y: number }): Promise<void> {
  await expect
    .poll(async () => {
      const { x, y } = await posizione(p);
      return Math.hypot(x - atteso.x, y - atteso.y);
    }, ENTRO_3_SECONDI)
    .toBeLessThan(3);
}

/** Punto dello schermo che corrisponde a un punto della mappa. */
async function suSchermo(pagina: Page, punto: { x: number; y: number }) {
  const box = await pagina.getByRole('group', { name: 'Mappa del dungeon' }).boundingBox();
  if (!box) throw new Error('Mappa non visibile');
  const scala = box.width / LARGHEZZA_MAPPA;
  return { x: box.x + punto.x * scala, y: box.y + punto.y * scala };
}

/** Trascina col dito (eventi touch veri) o col mouse, a seconda del dispositivo. */
async function trascina(pagina: Page, da: { x: number; y: number }, a: { x: number; y: number }) {
  const passi = 8;
  if (test.info().project.name === 'telefono') {
    const cdp = await pagina.context().newCDPSession(pagina);
    const tocco = async (
      type: 'touchStart' | 'touchMove' | 'touchEnd',
      p: { x: number; y: number },
    ) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: type === 'touchEnd' ? [] : [{ x: p.x, y: p.y }],
      });
    await tocco('touchStart', da);
    for (let i = 1; i <= passi; i++) {
      await tocco('touchMove', {
        x: da.x + ((a.x - da.x) * i) / passi,
        y: da.y + ((a.y - da.y) * i) / passi,
      });
    }
    await tocco('touchEnd', a);
    return;
  }
  await pagina.mouse.move(da.x, da.y);
  await pagina.mouse.down();
  await pagina.mouse.move(a.x, a.y, { steps: passi });
  await pagina.mouse.up();
}

test('la giocatrice trascina la sua pedina e il Master la vede spostata (RF-31)', async ({
  browser,
  request,
  page,
}) => {
  // Irene usa il dispositivo del progetto: desktop oppure telefono.
  const { master, irene, scheda } = await preparaTavolo(browser, request, page);

  const nuovoPg = master.locator('details', { hasText: 'Aggiungi un personaggio' });
  await nuovoPg.getByLabel('Nome').fill('Shania');
  await nuovoPg.getByLabel('Giocatore').selectOption({ label: 'Irene' });
  await nuovoPg.getByRole('button', { name: 'Aggiungi' }).click();
  await master.goto(scheda);

  // Il PG assegnato è il suo "Giochi come": la pedina ha il bordo dorato (RF-32).
  const sua = pedina(irene, 'Sh');
  await expect(sua).toHaveClass(/\bmio\b/, ENTRO_3_SECONDI);
  await expect(irene.getByLabel('Giochi come')).toHaveValue(/\d+/);
  await vicinaA(sua, PRIMO_POSTO);

  await sua.scrollIntoViewIfNeeded();
  await trascina(irene, await suSchermo(irene, PRIMO_POSTO), await suSchermo(irene, DESTINAZIONE));
  await vicinaA(pedina(master, 'Sh'), DESTINAZIONE);
  await vicinaA(sua, DESTINAZIONE);

  // Il Master le riporta ai posti di partenza (RF-34), con conferma nella pagina.
  await master.getByRole('button', { name: "Riporta le pedine all'ingresso" }).click();
  await master.getByRole('button', { name: 'Riporta', exact: true }).click();
  await vicinaA(sua, PRIMO_POSTO);
});

test('la mappa dei giocatori arriva solo dal server, mai l’immagine intera', async ({
  browser,
  request,
}) => {
  const { master, irene, scheda } = await preparaTavolo(browser, request);
  await master.goto(scheda);
  const immagine = (p: Page) =>
    p.getByRole('group', { name: 'Mappa del dungeon' }).locator('image');
  const [daMaster, daIrene] = [
    await immagine(master).getAttribute('href'),
    await immagine(irene).getAttribute('href'),
  ];
  expect(daMaster).toMatch(/^\/api\/partite\/\d+\/mappa\?k=intera-/);
  expect(daIrene).toMatch(/^\/api\/partite\/\d+\/mappa\?k=zone-/);
  const r = await irene.request.get(daIrene ?? '');
  expect(r.status()).toBe(200);
  expect(r.headers()['content-type']).toBe('image/png');
});

test('il Master scopre una zona e la giocatrice la vede entro 3 secondi (RF-22)', async ({
  browser,
  request,
  page,
}) => {
  const { master, irene, scheda } = await preparaTavolo(browser, request, page);
  await master.goto(scheda);
  const href = (p: Page) =>
    p.getByRole('group', { name: 'Mappa del dungeon' }).locator('image').getAttribute('href');
  const prima = await href(irene);

  // La giocatrice non ha il pannello, il Master vede in trasparenza le 10 zone coperte.
  await expect(irene.getByRole('region', { name: 'Zone' })).toHaveCount(0);
  const nebbia = master.locator('.nebbia-master path');
  await expect(nebbia).toHaveCount(10);

  const pannello = master.getByRole('region', { name: 'Zone' });
  await pannello.getByRole('checkbox', { name: '3 · Sacrario del falco' }).check();
  await expect(nebbia).toHaveCount(9, ENTRO_3_SECONDI);
  await expect.poll(() => href(irene), ENTRO_3_SECONDI).not.toBe(prima);

  // Togliendo la spunta la zona si ricopre.
  await pannello.getByRole('checkbox', { name: '3 · Sacrario del falco' }).uncheck();
  await expect(nebbia).toHaveCount(10, ENTRO_3_SECONDI);
  await expect.poll(() => href(irene), ENTRO_3_SECONDI).toBe(prima);
});
