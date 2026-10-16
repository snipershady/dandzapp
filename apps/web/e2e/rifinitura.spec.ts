import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ENTRO_3_SECONDI, preparaTavolo } from './aiuti.ts';

/** Fallisce se la pagina apre una finestra del browser (RNF-09). */
function vietaDialoghi(pagina: Page): void {
  pagina.on('dialog', (d) => {
    void d.dismiss();
    throw new Error(`Finestra del browser inattesa: ${d.type()} "${d.message()}"`);
  });
}

/** Tavolo con un po' di tutto: PG, mostri, narrazione, tiri. */
async function tavoloPieno(...args: Parameters<typeof preparaTavolo>) {
  const t = await preparaTavolo(...args);
  const { master, scheda } = t;
  const nuovoPg = master.locator('details', { hasText: 'Aggiungi un personaggio' });
  await nuovoPg.getByLabel('Nome').fill('Shania');
  await nuovoPg.getByLabel('Giocatore').selectOption({ label: 'Irene' });
  await nuovoPg.getByRole('button', { name: 'Aggiungi' }).click();
  await master.goto(scheda);
  const mostri = master.getByRole('region', { name: 'Mostri' });
  await mostri.getByLabel('Quantità').selectOption('3');
  await mostri.getByLabel('Zona di comparsa').selectOption({ label: "Scala d'ingresso" });
  await mostri.getByRole('button', { name: 'Aggiungi' }).click();
  const narrazione = master.getByRole('region', { name: 'Narrazione' });
  await narrazione.getByLabel('Testo da leggere ai giocatori').fill('Scendete la scala.');
  await narrazione.getByRole('button', { name: 'Pubblica' }).click();
  await master.getByRole('region', { name: 'Dadi' }).getByRole('button', { name: 'd20' }).click();
  await expect(
    master.getByRole('region', { name: 'Storico dei tiri' }).getByRole('listitem'),
  ).toHaveCount(1, ENTRO_3_SECONDI);
  return t;
}

test.describe('rifinitura (RNF-02…RNF-09)', () => {
  // Basta il progetto desktop: le larghezze le sceglie il test.
  test.skip(() => test.info().project.name !== 'desktop');

  test('nessuna pagina scorre in orizzontale, da 400 a 1280 px (RNF-02)', async ({
    browser,
    request,
    page,
  }) => {
    const { master, scheda, gestione } = await tavoloPieno(browser, request, page);
    const pagine: [Page, string][] = [
      [master, scheda],
      [master, gestione],
      [master, '/'],
      [master, '/partite/nuova'],
      [master, '/amministrazione'],
    ];
    const anonimo = await (await browser.newContext()).newPage();
    for (const p of ['/accedi', '/registrati', '/password-dimenticata']) pagine.push([anonimo, p]);

    for (const larghezza of [400, 768, 1280]) {
      for (const [pagina, url] of pagine) {
        await pagina.setViewportSize({ width: larghezza, height: 900 });
        await pagina.goto(url);
        await pagina.waitForLoadState('networkidle');
        const eccesso = await pagina.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(eccesso, `${url} a ${larghezza} px`).toBeLessThanOrEqual(0);
      }
    }
  });

  test('sugli schermi grandi dadi e storico stanno accanto alla mappa', async ({
    browser,
    request,
    page,
  }) => {
    const { irene } = await tavoloPieno(browser, request, page);
    await irene.setViewportSize({ width: 1400, height: 900 });
    const mappa = await irene.getByRole('group', { name: 'Mappa del dungeon' }).boundingBox();
    const dadi = await irene.getByRole('region', { name: 'Dadi' }).boundingBox();
    expect(dadi && mappa && dadi.x > mappa.x + mappa.width).toBe(true);
    await irene.setViewportSize({ width: 400, height: 900 });
    const mappaStretta = await irene
      .getByRole('group', { name: 'Mappa del dungeon' })
      .boundingBox();
    const dadiStretti = await irene.getByRole('region', { name: 'Dadi' }).boundingBox();
    expect(dadiStretti && mappaStretta && dadiStretti.y > mappaStretta.y).toBe(true);
  });

  test('accessibilità senza errori, nel tema chiaro e scuro (RNF-03, RNF-04)', async ({
    browser,
    request,
    page,
  }) => {
    const { master, irene, scheda, gestione } = await tavoloPieno(browser, request, page);
    const anonimo = await (await browser.newContext()).newPage();
    const pagine: [Page, string][] = [
      [master, scheda],
      [irene, scheda],
      [master, gestione],
      [master, '/'],
      [master, '/amministrazione'],
      [anonimo, '/accedi'],
      [anonimo, '/registrati'],
    ];
    for (const tema of ['Chiaro', 'Scuro']) {
      for (const [pagina, url] of pagine) {
        await pagina.goto(url);
        await pagina
          .getByRole('group', { name: 'Tema' })
          .getByRole('button', { name: tema })
          .click();
        await pagina.waitForLoadState('networkidle');
        const { violations } = await new AxeBuilder({ page: pagina })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        const riassunto = violations.map(
          (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
        );
        expect(riassunto, `${url} (tema ${tema.toLowerCase()})`).toEqual([]);
      }
    }
  });

  test("l'interruttore del tema vale anche dopo un nuovo caricamento (RNF-03)", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/accedi');
    const sfondo = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const chiaro = await sfondo();
    const tema = page.getByRole('group', { name: 'Tema' });

    await tema.getByRole('button', { name: 'Scuro' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'scuro');
    expect(await sfondo()).not.toBe(chiaro);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'scuro');
    await expect(tema.getByRole('button', { name: 'Scuro' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // "Automatico" torna a seguire il dispositivo.
    await tema.getByRole('button', { name: 'Automatico' }).click();
    await expect(page.locator('html')).not.toHaveAttribute('data-tema', /.*/);
    expect(await sfondo()).toBe(chiaro);
    await page.emulateMedia({ colorScheme: 'dark' });
    expect(await sfondo()).not.toBe(chiaro);
  });

  test('i testi degli utenti restano testo e nessuna finestra si apre (RNF-06, RNF-09)', async ({
    browser,
    request,
    page,
  }) => {
    const { master, irene, scheda } = await preparaTavolo(browser, request, page);
    vietaDialoghi(master);
    vietaDialoghi(irene);
    const nuovoPg = master.locator('details', { hasText: 'Aggiungi un personaggio' });
    await nuovoPg.getByLabel('Nome').fill('<i>Shania</i>');
    await nuovoPg.getByLabel('Giocatore').selectOption({ label: 'Irene' });
    await nuovoPg.getByRole('button', { name: 'Aggiungi' }).click();
    await master.goto(scheda);

    const img = '<img src=x onerror=alert(1)>';
    const mostri = master.getByRole('region', { name: 'Mostri' });
    await mostri.getByLabel('Tipo').selectOption({ label: 'Altro…' });
    await mostri.getByLabel('Nome del mostro').fill(img);
    await mostri.getByLabel('Zona di comparsa').selectOption({ label: "Scala d'ingresso" });
    await mostri.getByRole('button', { name: 'Aggiungi' }).click();

    const script = '<script>alert(2)</script>';
    const narrazione = master.getByRole('region', { name: 'Narrazione' });
    await narrazione.getByLabel('Testo da leggere ai giocatori').fill(script);
    await narrazione.getByRole('button', { name: 'Pubblica' }).click();

    const motivo = '<b onmouseover=alert(3)>x</b>';
    const dadi = irene.getByRole('region', { name: 'Dadi' });
    await expect(dadi.getByRole('button', { name: 'd20' })).toBeEnabled(ENTRO_3_SECONDI);
    await dadi.getByLabel('Motivo').fill(motivo);
    await dadi.getByRole('button', { name: 'd20' }).click();

    await expect(irene.getByRole('region', { name: 'Il Master legge' })).toContainText(
      script,
      ENTRO_3_SECONDI,
    );
    await expect(irene.getByRole('region', { name: 'Personaggi' })).toContainText('<i>Shania</i>');
    const storico = master.getByRole('region', { name: 'Storico dei tiri' });
    await expect(storico).toContainText(motivo, ENTRO_3_SECONDI);
    await expect(storico).toContainText('<i>Shania</i>');
    await expect(mostri.getByRole('listitem').first()).toContainText(img);
    // Nessun elemento creato dai testi: niente <img src=x>, <b>, <i> o <script> inseriti.
    for (const p of [master, irene]) {
      expect(await p.locator('img[src="x"], main b, main i, main script').count()).toBe(0);
    }
  });

  test('nessuna richiesta a siti esterni e nessun blocco della CSP (RNF-05, §15.5)', async ({
    browser,
    request,
    page,
  }) => {
    const esterne: string[] = [];
    const origine = new URL(test.info().project.use.baseURL ?? 'http://127.0.0.1:3100').origin;
    page.on('request', (r) => {
      if (!r.url().startsWith(origine) && !r.url().startsWith('data:')) esterne.push(r.url());
    });
    // La CSP (meta generato da SvelteKit) non deve bloccare nulla dell'app.
    const bloccati: string[] = [];
    page.on('console', (m) => {
      if (/Content Security Policy/i.test(m.text())) bloccati.push(m.text());
    });
    const { irene } = await tavoloPieno(browser, request, page);
    await irene.reload();
    await irene.waitForLoadState('networkidle');
    expect(esterne).toEqual([]);
    expect(bloccati).toEqual([]);
    await expect(irene.locator('meta[http-equiv="content-security-policy"]')).toHaveAttribute(
      'content',
      /script-src 'self' 'sha256-/,
    );
    expect(await irene.evaluate(() => document.fonts.check('16px "Alegreya Sans"'))).toBe(true);
  });
});
