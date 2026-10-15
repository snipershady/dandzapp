import { cp, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RispostaElencoAvventure, type DefinizioneAvventura } from '@dandzapp/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ErroreImportazione, importaAvventura } from '../src/avventure/importa.ts';
import { creaOPromuoviMaster } from '../src/utenti/master.ts';
import { creaContesto, registra, type Contesto } from './aiuti.ts';

const SESSIONE_0 = fileURLToPath(new URL('../../../avventure/sessione-0', import.meta.url));

let ctx: Contesto;
let temporanea: string;
let cartellaDati: string;
beforeEach(async () => {
  ctx = await creaContesto();
  temporanea = await mkdtemp(path.join(tmpdir(), 'dandzapp-avventure-'));
  cartellaDati = path.join(temporanea, 'dati');
});
afterEach(async () => {
  await ctx.chiudi();
  await rm(temporanea, { recursive: true, force: true });
});

const importa = (cartella: string) => importaAvventura(ctx.db, { cartella, cartellaDati });

/** Copia della Sessione 0 con avventura.json modificato. */
async function copiaModificata(
  modifica: (a: DefinizioneAvventura) => void = () => undefined,
): Promise<string> {
  const copia = path.join(temporanea, 'sorgente');
  await cp(SESSIONE_0, copia, { recursive: true });
  const file = path.join(copia, 'avventura.json');
  const definizione = JSON.parse(await readFile(file, 'utf8')) as DefinizioneAvventura;
  modifica(definizione);
  await writeFile(file, JSON.stringify(definizione));
  return copia;
}

describe('importazione', () => {
  it('importa la Sessione 0 e copia solo le immagini per il tavolo, mai la mappa del Master', async () => {
    const { definizione, nuova } = await importa(SESSIONE_0);

    expect(nuova).toBe(true);
    expect(definizione).toMatchObject({ id: 'sessione-0', titolo: 'Il santuario sepolto' });
    expect(definizione.zoneIniziali).toEqual(['ingresso']);

    const riga = await ctx.db.selectFrom('avventure').selectAll().executeTakeFirstOrThrow();
    expect(riga).toMatchObject({
      slug: 'sessione-0',
      sottotitolo: 'Emirato di Nithia · sessione 0',
    });
    expect(riga.definizione.zone).toHaveLength(11);

    const copiati = await readdir(path.join(cartellaDati, 'avventure', 'sessione-0'), {
      recursive: true,
    });
    expect(copiati.sort()).toEqual(['mappa_giocatori.png', 'segreti', 'segreti/passaggio.png']);
  });

  it('una seconda importazione aggiorna la stessa avventura', async () => {
    await importa(SESSIONE_0);
    const sorgente = await copiaModificata((a) => {
      a.titolo = 'Il santuario sepolto (rivisto)';
    });
    const { nuova } = await importa(sorgente);

    expect(nuova).toBe(false);
    const righe = await ctx.db.selectFrom('avventure').select('titolo').execute();
    expect(righe).toEqual([{ titolo: 'Il santuario sepolto (rivisto)' }]);
  });

  it.each([
    [
      'zona iniziale inesistente',
      (a: DefinizioneAvventura) => (a.zoneIniziali = ['cantina']),
      'Zona inesistente: cantina',
    ],
    [
      'segreto legato a una zona inesistente',
      (a: DefinizioneAvventura) => (a.segreti[0]!.zona = 'soffitta'),
      'Zona inesistente: soffitta',
    ],
    [
      'zone duplicate',
      (a: DefinizioneAvventura) => (a.zone[1]!.id = a.zone[0]!.id),
      'Zona duplicata',
    ],
    [
      'percorso che risale di cartella',
      (a: DefinizioneAvventura) => (a.mappa.immagine = '../master/mappa_master.png'),
      'Percorso del file non valido',
    ],
    [
      'percorso SVG con comandi non ammessi',
      (a: DefinizioneAvventura) => (a.zone[0]!.percorso = 'M0,0 L10,10 Z"/><script>'),
      'sono ammessi solo i comandi M, L e Z',
    ],
    [
      'posto di partenza fuori dalla mappa',
      (a: DefinizioneAvventura) => a.partenze.push([5000, 10]),
      'Posto di partenza fuori dalla mappa',
    ],
    [
      'immagine mancante',
      (a: DefinizioneAvventura) => (a.mappa.immagine = 'non_esiste.png'),
      'Immagine mancante: non_esiste.png',
    ],
    [
      'dimensioni diverse da quelle dichiarate',
      (a: DefinizioneAvventura) => (a.mappa.larghezza = 1500),
      'misura 1480×1080, ma avventura.json dichiara 1500×1080',
    ],
  ])('rifiuta: %s', async (_caso, modifica, messaggio) => {
    const sorgente = await copiaModificata(modifica);
    const errore = await importa(sorgente).catch((e: unknown) => e);
    expect(errore).toBeInstanceOf(ErroreImportazione);
    expect((errore as Error).message).toContain(messaggio);
    expect(await ctx.db.selectFrom('avventure').select('id').execute()).toHaveLength(0);
  });

  it('rifiuta un file che non è un PNG', async () => {
    const sorgente = await copiaModificata();
    await writeFile(path.join(sorgente, 'segreti', 'passaggio.png'), 'non sono un png');
    await expect(importa(sorgente)).rejects.toThrow("Non è un'immagine PNG: segreti/passaggio.png");
  });

  it('rifiuta un JSON malformato', async () => {
    const sorgente = await copiaModificata();
    await writeFile(path.join(sorgente, 'avventura.json'), '{ "formato": 1,');
    await expect(importa(sorgente)).rejects.toThrow('non è un JSON valido');
  });

  it("un'importazione fallita non tocca l'avventura già importata", async () => {
    await importa(SESSIONE_0);
    const sorgente = await copiaModificata((a) => (a.mappa.altezza = 1));
    await expect(importa(sorgente)).rejects.toThrow(ErroreImportazione);

    const copiati = await readdir(path.join(cartellaDati, 'avventure', 'sessione-0'));
    expect(copiati).toContain('mappa_giocatori.png');
    const riga = await ctx.db
      .selectFrom('avventure')
      .select('definizione')
      .executeTakeFirstOrThrow();
    expect(riga.definizione.mappa.altezza).toBe(1080);
  });
});

describe('GET /api/avventure', () => {
  const elenco = (token?: string) =>
    ctx.app.inject({
      method: 'GET',
      url: '/api/avventure',
      ...(token ? { cookies: { sessione: token } } : {}),
    });

  it('è riservato ai Master', async () => {
    expect((await elenco()).statusCode).toBe(401);
    const giocatore = await registra(ctx.app, { email: 'irene@esempio.it' });
    expect((await elenco(giocatore)).statusCode).toBe(403);
  });

  it('mostra un riepilogo senza zone né immagini', async () => {
    await importa(SESSIONE_0);
    const master = await registra(ctx.app, { email: 'master@esempio.it' });
    await creaOPromuoviMaster(ctx.db, { email: 'master@esempio.it', nome: '' });

    const risposta = await elenco(master);
    expect(risposta.statusCode).toBe(200);
    expect(RispostaElencoAvventure.parse(risposta.json())).toEqual({
      avventure: [
        {
          id: 'sessione-0',
          titolo: 'Il santuario sepolto',
          sottotitolo: 'Emirato di Nithia · sessione 0',
          numeroZone: 11,
          numeroPartenze: 8,
          mostri: ['Scorpione gigante', 'Spettro', 'Stirge', 'Gargolla'],
        },
      ],
    });
    // Nessun nome di zona (es. "Passaggio segreto") né percorso arriva al browser.
    expect(risposta.body).not.toContain('Passaggio');
    expect(risposta.body).not.toContain('png');
  });
});
