import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DettaglioPartita,
  InfoInvito,
  RispostaElencoPartite,
  RispostaInvitoCreato,
} from '@dandzapp/shared';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { importaAvventura } from '../src/avventure/importa.ts';
import { DURATA_INVITO_MS } from '../src/partite/inviti.ts';
import { creaOPromuoviMaster } from '../src/utenti/master.ts';
import { creaContesto, registra, type Contesto } from './aiuti.ts';

const SESSIONE_0 = fileURLToPath(new URL('../../../avventure/sessione-0', import.meta.url));

let ctx: Contesto;
let temporanea: string;
let master: string;
beforeEach(async () => {
  temporanea = await mkdtemp(path.join(tmpdir(), 'dandzapp-partite-'));
  // Le immagini dell'avventura (e le mappe composte) stanno nella cartella temporanea.
  ctx = await creaContesto({ cartellaDati: temporanea });
  await importaAvventura(ctx.db, { cartella: SESSIONE_0, cartellaDati: temporanea });
  master = await registra(ctx.app, { email: 'marco@esempio.it', nome: 'Marco' });
  await creaOPromuoviMaster(ctx.db, { email: 'marco@esempio.it', nome: '' });
});
afterEach(async () => {
  await ctx.chiudi();
  await rm(temporanea, { recursive: true, force: true });
});

type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
const chiama = (token: string | null, method: Metodo, url: string, payload?: object) =>
  ctx.app.inject({
    method,
    url,
    ...(payload ? { payload } : {}),
    ...(token ? { cookies: { sessione: token } } : {}),
  });

async function nuovaPartita(token = master, titolo = 'Il santuario sepolto'): Promise<number> {
  const r = await chiama(token, 'POST', '/api/partite', { titolo, avventura: 'sessione-0' });
  expect(r.statusCode).toBe(201);
  return r.json().id as number;
}

const dettaglio = async (token: string, id: number) =>
  DettaglioPartita.parse((await chiama(token, 'GET', `/api/partite/${id}`)).json());

/** Invita, accetta e restituisce la sessione del nuovo partecipante. */
async function unisci(
  partitaId: number,
  email: string,
  opzioni: { ruolo?: 'giocatore' | 'osservatore'; personaggioId?: number | null } = {},
): Promise<{ token: string; utenteId: number }> {
  const token = await registra(ctx.app, { email, nome: email.split('@')[0] ?? 'x' });
  const invito = await chiama(master, 'POST', `/api/partite/${partitaId}/inviti`, {
    email,
    ...opzioni,
  });
  expect(invito.statusCode).toBe(201);
  const link = RispostaInvitoCreato.parse(invito.json()).link;
  const accetta = await chiama(token, 'POST', `/api/inviti/${link.split('/').at(-1)}/accetta`);
  expect(accetta.statusCode).toBe(200);
  const io = await chiama(token, 'GET', '/api/auth/io');
  return { token, utenteId: io.json().utente.id as number };
}

describe('creazione ed elenco', () => {
  it('solo un ROLE_MASTER crea partite, con un’avventura esistente', async () => {
    const giocatore = await registra(ctx.app, { email: 'irene@esempio.it' });
    expect(
      (await chiama(giocatore, 'POST', '/api/partite', { titolo: 'X', avventura: 'sessione-0' }))
        .statusCode,
    ).toBe(403);
    const r = await chiama(master, 'POST', '/api/partite', { titolo: 'Prova', avventura: 'boh' });
    expect(r.statusCode).toBe(400);
    expect(r.json().campi).toEqual({ avventura: 'Avventura inesistente' });
  });

  it('"Le mie partite" separa le partite condotte da quelle giocate', async () => {
    const id = await nuovaPartita();
    const { token } = await unisci(id, 'irene@esempio.it');

    const delMaster = RispostaElencoPartite.parse(
      (await chiama(master, 'GET', '/api/partite')).json(),
    );
    expect(delMaster.conduco).toHaveLength(1);
    expect(delMaster.conduco[0]).toMatchObject({
      id,
      mioRuolo: 'master',
      numeroPartecipanti: 1,
      avventura: { titolo: 'Il santuario sepolto' },
      master: { nome: 'Marco' },
    });
    expect(delMaster.partecipo).toEqual([]);

    const diIrene = RispostaElencoPartite.parse(
      (await chiama(token, 'GET', '/api/partite')).json(),
    );
    expect(diIrene.conduco).toEqual([]);
    expect(diIrene.partecipo.map((p) => [p.id, p.mioRuolo])).toEqual([[id, 'giocatore']]);
  });
});

describe('isolamento tra partite (RF-06)', () => {
  it('chi non partecipa riceve 404 su tutto, come se la partita non esistesse', async () => {
    const id = await nuovaPartita();
    const estraneo = await registra(ctx.app, { email: 'estraneo@esempio.it' });

    expect((await chiama(estraneo, 'GET', `/api/partite/${id}`)).statusCode).toBe(404);
    expect(
      (await chiama(estraneo, 'PATCH', `/api/partite/${id}`, { titolo: 'Mia' })).statusCode,
    ).toBe(404);
    expect(
      (await chiama(estraneo, 'POST', `/api/partite/${id}/inviti`, { email: 'x@esempio.it' }))
        .statusCode,
    ).toBe(404);
    expect((await chiama(estraneo, 'GET', `/api/partite/9999`)).statusCode).toBe(404);
    const elenco = RispostaElencoPartite.parse(
      (await chiama(estraneo, 'GET', '/api/partite')).json(),
    );
    expect(elenco).toEqual({ conduco: [], partecipo: [] });
  });

  it('un altro Master non vede né modifica le partite altrui', async () => {
    const id = await nuovaPartita();
    const altro = await registra(ctx.app, { email: 'altro@esempio.it' });
    await creaOPromuoviMaster(ctx.db, { email: 'altro@esempio.it', nome: '' });
    expect((await chiama(altro, 'GET', `/api/partite/${id}`)).statusCode).toBe(404);
    expect((await chiama(altro, 'DELETE', `/api/partite/${id}`)).statusCode).toBe(404);
  });

  it('un giocatore della partita non può fare azioni da Master: 403', async () => {
    const id = await nuovaPartita();
    const { token } = await unisci(id, 'irene@esempio.it');
    const url = `/api/partite/${id}`;
    expect((await chiama(token, 'PATCH', url, { titolo: 'Mia' })).statusCode).toBe(403);
    expect((await chiama(token, 'DELETE', url)).statusCode).toBe(403);
    expect(
      (await chiama(token, 'POST', `${url}/personaggi`, { nome: 'X', sigla: 'X' })).statusCode,
    ).toBe(403);
    expect((await chiama(token, 'POST', `${url}/inviti`, { email: 'a@b.it' })).statusCode).toBe(
      403,
    );
  });

  it('il dettaglio mostra gli inviti solo al Master', async () => {
    const id = await nuovaPartita();
    const { token } = await unisci(id, 'irene@esempio.it');
    await chiama(master, 'POST', `/api/partite/${id}/inviti`, { email: 'fabio@esempio.it' });

    expect((await dettaglio(master, id)).inviti?.map((i) => i.email)).toEqual(['fabio@esempio.it']);
    const visto = await dettaglio(token, id);
    expect(visto.inviti).toBeUndefined();
    expect(visto.partita.mioRuolo).toBe('giocatore');
  });
});

describe('personaggi', () => {
  const pg = (id: number, dati: object, token = master) =>
    chiama(token, 'POST', `/api/partite/${id}/personaggi`, dati);

  it('nascono nei posti di partenza dell’avventura, in ordine', async () => {
    const id = await nuovaPartita();
    await pg(id, { nome: 'Shania', classe: 'Guerriera', sigla: 'Sh', colore: '#A8322A' });
    await pg(id, { nome: 'Duronin', classe: 'Nano', sigla: 'Du', colore: '#8a5a1c' });

    const righe = await ctx.db
      .selectFrom('personaggi')
      .select(['nome', 'posto', 'x', 'y', 'colore'])
      .orderBy('id')
      .execute();
    expect(righe).toEqual([
      { nome: 'Shania', posto: 0, x: 460, y: 880, colore: '#a8322a' },
      { nome: 'Duronin', posto: 1, x: 500, y: 880, colore: '#8a5a1c' },
    ]);
  });

  it('il posto di un PG eliminato torna libero', async () => {
    const id = await nuovaPartita();
    const primo = (await pg(id, { nome: 'Shania', sigla: 'Sh' })).json().id as number;
    await pg(id, { nome: 'Duronin', sigla: 'Du' });
    expect(
      (await chiama(master, 'DELETE', `/api/partite/${id}/personaggi/${primo}`)).statusCode,
    ).toBe(204);
    await pg(id, { nome: 'Dworgin', sigla: 'Dw' });

    const dworgin = await ctx.db
      .selectFrom('personaggi')
      .select('posto')
      .where('nome', '=', 'Dworgin')
      .executeTakeFirstOrThrow();
    expect(dworgin.posto).toBe(0);
  });

  it('nome e sigla sono unici nella partita, non tra partite diverse', async () => {
    const a = await nuovaPartita();
    const b = await nuovaPartita(master, 'Altra');
    await pg(a, { nome: 'Shania', sigla: 'Sh' });

    const stessaSigla = await pg(a, { nome: 'Shanti', sigla: 'Sh' });
    expect(stessaSigla.statusCode).toBe(409);
    expect(stessaSigla.json().campi).toEqual({ sigla: 'Sigla già usata da un altro PG' });
    expect((await pg(a, { nome: 'Shania', sigla: 'Sa' })).json().campi).toEqual({
      nome: 'Esiste già un PG con questo nome',
    });
    expect((await pg(b, { nome: 'Shania', sigla: 'Sh' })).statusCode).toBe(201);
  });

  it('si assegna solo a chi partecipa come giocatore', async () => {
    const id = await nuovaPartita();
    const { utenteId: irene } = await unisci(id, 'irene@esempio.it');
    const { utenteId: osservatore } = await unisci(id, 'oss@esempio.it', { ruolo: 'osservatore' });
    const estraneo = await registra(ctx.app, { email: 'estraneo@esempio.it' });
    const estraneoId = (await chiama(estraneo, 'GET', '/api/auth/io')).json().utente.id as number;

    for (const utenteId of [osservatore, estraneoId]) {
      const r = await pg(id, { nome: `PG ${utenteId}`, sigla: 'Xx', utenteId });
      expect(r.statusCode).toBe(400);
      expect(r.json().campi).toHaveProperty('utenteId');
    }
    const ok = await pg(id, { nome: 'Shania', sigla: 'Sh', utenteId: irene });
    expect(ok.json()).toMatchObject({ nome: 'Shania', utenteId: irene });
    // Diventa il "Giochi come" di Irene (RF-03).
    const p = await ctx.db
      .selectFrom('partecipazioni')
      .select('personaggio_id')
      .where('utente_id', '=', irene)
      .executeTakeFirstOrThrow();
    expect(p.personaggio_id).toBe(ok.json().id);
  });

  it('un PG di un’altra partita non si modifica da questa', async () => {
    const a = await nuovaPartita();
    const b = await nuovaPartita(master, 'Altra');
    const pgA = (await pg(a, { nome: 'Shania', sigla: 'Sh' })).json().id as number;
    const r = await chiama(master, 'PATCH', `/api/partite/${b}/personaggi/${pgA}`, { nome: 'X' });
    expect(r.statusCode).toBe(404);
  });
});

describe('inviti (RF-02)', () => {
  const invita = (id: number, dati: object) =>
    chiama(master, 'POST', `/api/partite/${id}/inviti`, dati);
  const tokenDa = (link: string) => link.split('/').at(-1) ?? '';

  it('manda l’email con il link e lo restituisce al Master', async () => {
    const id = await nuovaPartita();
    const r = await invita(id, { email: 'Irene@Esempio.it' });
    expect(r.statusCode).toBe(201);
    const { invito, link } = RispostaInvitoCreato.parse(r.json());
    expect(invito).toMatchObject({ email: 'irene@esempio.it', ruolo: 'giocatore', scaduto: false });
    expect(link).toMatch(/^http:\/\/localhost:5173\/inviti\/[\w-]{43}$/);
    expect(ctx.posta.at(-1)).toMatchObject({ a: 'irene@esempio.it' });
    expect(ctx.posta.at(-1)?.testo).toContain(link);
  });

  it('chi apre il link vede l’invito anche senza accesso', async () => {
    const id = await nuovaPartita();
    const shania = (
      await chiama(master, 'POST', `/api/partite/${id}/personaggi`, { nome: 'Shania', sigla: 'Sh' })
    ).json().id;
    const { link } = RispostaInvitoCreato.parse(
      (await invita(id, { email: 'irene@esempio.it', personaggioId: shania })).json(),
    );

    const r = await chiama(null, 'GET', `/api/inviti/${tokenDa(link)}`);
    expect(InfoInvito.parse(r.json())).toEqual({
      partita: { titolo: 'Il santuario sepolto' },
      master: { nome: 'Marco' },
      email: 'irene@esempio.it',
      ruolo: 'giocatore',
      personaggio: 'Shania',
      stato: 'valido',
    });
    expect((await chiama(null, 'GET', '/api/inviti/inventato')).statusCode).toBe(404);
  });

  it('accettandolo si entra nella partita con il PG indicato; il link vale una volta sola', async () => {
    const id = await nuovaPartita();
    const shania = (
      await chiama(master, 'POST', `/api/partite/${id}/personaggi`, { nome: 'Shania', sigla: 'Sh' })
    ).json().id;
    const { link } = RispostaInvitoCreato.parse(
      (await invita(id, { email: 'irene@esempio.it', personaggioId: shania })).json(),
    );
    const irene = await registra(ctx.app, { email: 'irene@esempio.it', nome: 'Irene' });

    expect((await chiama(null, 'POST', `/api/inviti/${tokenDa(link)}/accetta`)).statusCode).toBe(
      401,
    );
    const r = await chiama(irene, 'POST', `/api/inviti/${tokenDa(link)}/accetta`);
    expect(r.json()).toEqual({ id });

    const d = await dettaglio(irene, id);
    expect(d.partecipanti).toEqual([
      expect.objectContaining({ nome: 'Irene', ruolo: 'giocatore' }),
    ]);
    expect(d.personaggi[0]?.utenteId).toBe(d.partecipanti[0]?.utenteId);
    expect((await dettaglio(master, id)).inviti).toEqual([]);

    expect((await chiama(irene, 'POST', `/api/inviti/${tokenDa(link)}/accetta`)).statusCode).toBe(
      409,
    );
    expect(
      InfoInvito.parse((await chiama(null, 'GET', `/api/inviti/${tokenDa(link)}`)).json()).stato,
    ).toBe('usato');
  });

  it('vale solo per l’email invitata', async () => {
    const id = await nuovaPartita();
    const { link } = RispostaInvitoCreato.parse(
      (await invita(id, { email: 'irene@esempio.it' })).json(),
    );
    const fabio = await registra(ctx.app, { email: 'fabio@esempio.it' });
    const r = await chiama(fabio, 'POST', `/api/inviti/${tokenDa(link)}/accetta`);
    expect(r.statusCode).toBe(403);
    expect(r.json().errore).toContain('irene@esempio.it');
  });

  it('scade dopo 7 giorni', async () => {
    const id = await nuovaPartita();
    const { link } = RispostaInvitoCreato.parse(
      (await invita(id, { email: 'irene@esempio.it' })).json(),
    );
    const irene = await registra(ctx.app, { email: 'irene@esempio.it' });
    ctx.avanza(DURATA_INVITO_MS + 1000);
    expect((await chiama(irene, 'POST', `/api/inviti/${tokenDa(link)}/accetta`)).statusCode).toBe(
      410,
    );
  });

  it('un nuovo invito alla stessa email sostituisce il precedente', async () => {
    const id = await nuovaPartita();
    const vecchio = RispostaInvitoCreato.parse(
      (await invita(id, { email: 'irene@esempio.it' })).json(),
    );
    await invita(id, { email: 'irene@esempio.it', ruolo: 'osservatore' });
    expect((await chiama(null, 'GET', `/api/inviti/${tokenDa(vecchio.link)}`)).statusCode).toBe(
      404,
    );
    expect((await dettaglio(master, id)).inviti?.map((i) => i.ruolo)).toEqual(['osservatore']);
  });

  it('rifiuta chi partecipa già, il Master stesso e un osservatore con PG', async () => {
    const id = await nuovaPartita();
    await unisci(id, 'irene@esempio.it');
    expect((await invita(id, { email: 'irene@esempio.it' })).statusCode).toBe(409);
    expect((await invita(id, { email: 'marco@esempio.it' })).statusCode).toBe(409);
    const pgId = (
      await chiama(master, 'POST', `/api/partite/${id}/personaggi`, { nome: 'S', sigla: 'S' })
    ).json().id;
    const r = await invita(id, {
      email: 'oss@esempio.it',
      ruolo: 'osservatore',
      personaggioId: pgId,
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().campi).toEqual({ personaggioId: 'Un osservatore non controlla personaggi' });
  });

  it('si può revocare; una partita archiviata non accetta inviti', async () => {
    const id = await nuovaPartita();
    const { invito, link } = RispostaInvitoCreato.parse(
      (await invita(id, { email: 'irene@esempio.it' })).json(),
    );
    await chiama(master, 'PATCH', `/api/partite/${id}`, { stato: 'archiviata' });

    const irene = await registra(ctx.app, { email: 'irene@esempio.it' });
    expect((await chiama(irene, 'POST', `/api/inviti/${tokenDa(link)}/accetta`)).statusCode).toBe(
      409,
    );
    expect((await invita(id, { email: 'fabio@esempio.it' })).statusCode).toBe(409);

    expect(
      (await chiama(master, 'DELETE', `/api/partite/${id}/inviti/${invito.id}`)).statusCode,
    ).toBe(204);
    expect((await chiama(null, 'GET', `/api/inviti/${tokenDa(link)}`)).statusCode).toBe(404);
  });
});

describe('partecipanti', () => {
  it('passando a osservatore si perdono i PG; togliendo un partecipante i PG restano liberi', async () => {
    const id = await nuovaPartita();
    const { utenteId: irene } = await unisci(id, 'irene@esempio.it');
    const { utenteId: fabio } = await unisci(id, 'fabio@esempio.it');
    await chiama(master, 'POST', `/api/partite/${id}/personaggi`, {
      nome: 'Shania',
      sigla: 'Sh',
      utenteId: irene,
    });
    await chiama(master, 'POST', `/api/partite/${id}/personaggi`, {
      nome: 'Duronin',
      sigla: 'Du',
      utenteId: fabio,
    });

    expect(
      (
        await chiama(master, 'PATCH', `/api/partite/${id}/partecipanti/${irene}`, {
          ruolo: 'osservatore',
        })
      ).statusCode,
    ).toBe(204);
    expect(
      (await chiama(master, 'DELETE', `/api/partite/${id}/partecipanti/${fabio}`)).statusCode,
    ).toBe(204);

    const d = await dettaglio(master, id);
    expect(d.partecipanti).toEqual([
      { utenteId: irene, nome: 'irene', ruolo: 'osservatore', personaggioId: null },
    ]);
    expect(d.personaggi.map((p) => p.utenteId)).toEqual([null, null]);
  });

  it('un giocatore può lasciare la partita, ma non togliere gli altri', async () => {
    const id = await nuovaPartita();
    const irene = await unisci(id, 'irene@esempio.it');
    const fabio = await unisci(id, 'fabio@esempio.it');
    expect(
      (await chiama(irene.token, 'DELETE', `/api/partite/${id}/partecipanti/${fabio.utenteId}`))
        .statusCode,
    ).toBe(403);
    expect(
      (await chiama(irene.token, 'DELETE', `/api/partite/${id}/partecipanti/${irene.utenteId}`))
        .statusCode,
    ).toBe(204);
    expect((await chiama(irene.token, 'GET', `/api/partite/${id}`)).statusCode).toBe(404);
  });

  it('modificare un partecipante inesistente dà 404', async () => {
    const id = await nuovaPartita();
    expect(
      (await chiama(master, 'PATCH', `/api/partite/${id}/partecipanti/999`, { ruolo: 'giocatore' }))
        .statusCode,
    ).toBe(404);
  });
});

describe('gestione della partita', () => {
  it('il Master la rinomina, la archivia e la elimina con tutto il contenuto', async () => {
    const id = await nuovaPartita();
    await unisci(id, 'irene@esempio.it');
    await chiama(master, 'POST', `/api/partite/${id}/personaggi`, { nome: 'Shania', sigla: 'Sh' });
    await chiama(master, 'POST', `/api/partite/${id}/inviti`, { email: 'fabio@esempio.it' });

    expect(
      (
        await chiama(master, 'PATCH', `/api/partite/${id}`, {
          titolo: 'Nuovo titolo',
          stato: 'archiviata',
        })
      ).statusCode,
    ).toBe(204);
    expect((await dettaglio(master, id)).partita).toMatchObject({
      titolo: 'Nuovo titolo',
      stato: 'archiviata',
    });

    expect((await chiama(master, 'DELETE', `/api/partite/${id}`)).statusCode).toBe(204);
    for (const tabella of ['partite', 'personaggi', 'partecipazioni', 'inviti'] as const) {
      expect(await ctx.db.selectFrom(tabella).selectAll().execute()).toEqual([]);
    }
  });
});

describe('mappa del tavolo (RF-10, §15.3)', () => {
  /** Colore RGBA di un pixel di un PNG. */
  async function pixel(png: Buffer, x: number, y: number): Promise<number[]> {
    const { data, info } = await sharp(png)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const i = (y * info.width + x) * 4;
    return [...data.subarray(i, i + 4)];
  }
  const mappa = (token: string, id: number) => chiama(token, 'GET', `/api/partite/${id}/mappa`);
  // Punti interni alla Scala d'ingresso (zona iniziale) e al Sacrario del falco (coperto).
  const INGRESSO = [480, 900] as const;
  const SACRARIO = [380, 192] as const;
  // Un punto della parete del passaggio segreto: bianco nella mappa, nero nel ritaglio.
  const SEGRETO = [620, 188] as const;

  it('la partita nasce con le sole zone iniziali scoperte (RF-23)', async () => {
    const id = await nuovaPartita();
    const zone = await ctx.db.selectFrom('zone_scoperte').selectAll().execute();
    expect(zone).toEqual([{ partita_id: id, zona_id: 'ingresso' }]);
    const { mappa: info } = await dettaglio(master, id);
    expect(info).toMatchObject({ larghezza: 1480, altezza: 1080, quadretto: { px: 40, metri: 3 } });
  });

  it('il Master riceve la mappa intera, i giocatori solo le zone scoperte', async () => {
    const id = await nuovaPartita();
    const { token } = await unisci(id, 'irene@esempio.it');
    const originale = await readFile(
      path.join(temporanea, 'avventure', 'sessione-0', 'mappa_giocatori.png'),
    );

    // Il Master vede tutto, compresi i segreti già al loro posto.
    const delMaster = await mappa(master, id);
    expect(delMaster.statusCode).toBe(200);
    expect(await pixel(delMaster.rawPayload, ...SACRARIO)).toEqual(
      await pixel(originale, ...SACRARIO),
    );
    expect((await pixel(originale, ...SEGRETO))[0]).toBeGreaterThan(240);
    expect((await pixel(delMaster.rawPayload, ...SEGRETO)).slice(0, 3)).toEqual([17, 17, 17]);

    const r = await mappa(token, id);
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-type']).toBe('image/png');
    expect((await pixel(r.rawPayload, ...SACRARIO))[3]).toBe(0);
    expect(await pixel(r.rawPayload, ...INGRESSO)).toEqual(await pixel(originale, ...INGRESSO));

    // Scoperta una zona, cambiano la chiave e l'immagine.
    const prima = (await dettaglio(token, id)).mappa.chiave;
    await ctx.db.insertInto('zone_scoperte').values({ partita_id: id, zona_id: 'sala3' }).execute();
    expect((await dettaglio(token, id)).mappa.chiave).not.toBe(prima);
    const dopo = await mappa(token, id);
    expect(await pixel(dopo.rawPayload, ...SACRARIO)).toEqual(await pixel(originale, ...SACRARIO));
  });

  it('chi non partecipa riceve 404; la mappa non va nelle cache condivise', async () => {
    const id = await nuovaPartita();
    const estraneo = await registra(ctx.app, { email: 'estraneo@esempio.it' });
    expect((await mappa(estraneo, id)).statusCode).toBe(404);
    expect((await chiama(null, 'GET', `/api/partite/${id}/mappa`)).statusCode).toBe(401);

    const { token } = await unisci(id, 'irene@esempio.it');
    const r = await mappa(token, id);
    expect(r.headers['cache-control']).toBe('private, no-cache');
    const etag = String(r.headers['etag']);
    const ancora = await ctx.app.inject({
      method: 'GET',
      url: `/api/partite/${id}/mappa`,
      cookies: { sessione: token },
      headers: { 'if-none-match': etag },
    });
    expect(ancora.statusCode).toBe(304);
    // Il Master ha un'immagine diversa, quindi un'altra chiave.
    expect((await mappa(master, id)).headers['etag']).not.toBe(etag);
  });
});

describe('"Giochi come" (RF-03)', () => {
  it('il giocatore sceglie uno dei PG della partita, o nessuno', async () => {
    const id = await nuovaPartita();
    const { token, utenteId } = await unisci(id, 'irene@esempio.it');
    const pg = (
      await chiama(master, 'POST', `/api/partite/${id}/personaggi`, { nome: 'Shania', sigla: 'Sh' })
    ).json().id as number;

    expect(
      (await chiama(token, 'PUT', `/api/partite/${id}/io`, { personaggioId: pg })).statusCode,
    ).toBe(204);
    const mia = async () =>
      (await dettaglio(master, id)).partecipanti.find((p) => p.utenteId === utenteId);
    expect((await mia())?.personaggioId).toBe(pg);
    expect(
      (await chiama(token, 'PUT', `/api/partite/${id}/io`, { personaggioId: null })).statusCode,
    ).toBe(204);
    expect((await mia())?.personaggioId).toBeNull();
  });

  it('rifiuta Master, osservatori, estranei e PG di altre partite', async () => {
    const id = await nuovaPartita();
    const altra = await nuovaPartita(master, 'Altra');
    const pgAltra = (
      await chiama(master, 'POST', `/api/partite/${altra}/personaggi`, {
        nome: 'Duronin',
        sigla: 'Du',
      })
    ).json().id as number;
    const { token } = await unisci(id, 'irene@esempio.it');
    const osservatore = await unisci(id, 'luca@esempio.it', { ruolo: 'osservatore' });
    const estraneo = await registra(ctx.app, { email: 'estraneo@esempio.it' });
    const io = (t: string, corpo: object) => chiama(t, 'PUT', `/api/partite/${id}/io`, corpo);

    expect((await io(master, { personaggioId: null })).statusCode).toBe(403);
    expect((await io(osservatore.token, { personaggioId: null })).statusCode).toBe(403);
    expect((await io(estraneo, { personaggioId: null })).statusCode).toBe(404);
    const r = await io(token, { personaggioId: pgAltra });
    expect(r.statusCode).toBe(400);
    expect(r.json().campi).toEqual({ personaggioId: 'Personaggio inesistente' });
    expect((await io(token, { personaggioId: 'Shania' })).statusCode).toBe(400);
  });
});

describe('nebbia di guerra (RF-20…RF-24)', () => {
  async function pixel(png: Buffer, x: number, y: number): Promise<number[]> {
    const { data, info } = await sharp(png)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const i = (y * info.width + x) * 4;
    return [...data.subarray(i, i + 4)];
  }
  const SEGRETO = [620, 188] as const;
  // Un punto del Sacrario che il ritaglio del segreto ridisegna: il ritaglio sconfina lì.
  const NEL_SACRARIO = [568, 188] as const;
  const scopri = (id: number, zonaId: string, scoperta = true) =>
    ctx.db
      .transaction()
      .execute(async (trx) =>
        scoperta
          ? trx.insertInto('zone_scoperte').values({ partita_id: id, zona_id: zonaId }).execute()
          : trx
              .deleteFrom('zone_scoperte')
              .where('partita_id', '=', id)
              .where('zona_id', '=', zonaId)
              .execute(),
      );

  it('le zone e i loro poligoni arrivano solo al Master', async () => {
    const id = await nuovaPartita();
    const { token } = await unisci(id, 'irene@esempio.it');
    const delMaster = await dettaglio(master, id);
    expect(delMaster.zone).toHaveLength(11);
    expect(delMaster.zone?.filter((z) => z.scoperta).map((z) => z.id)).toEqual(['ingresso']);
    const risposta = await chiama(token, 'GET', `/api/partite/${id}`);
    expect(risposta.json().zone).toBeUndefined();
    // Nessun poligono né nome di zona nei dati del giocatore.
    expect(risposta.body).not.toContain('Sacrario');
    expect(risposta.body).not.toContain('M572.0');
  });

  it('il passaggio segreto compare ai giocatori solo a zona scoperta', async () => {
    const id = await nuovaPartita();
    const { token } = await unisci(id, 'irene@esempio.it');
    const immagine = async () =>
      (await chiama(token, 'GET', `/api/partite/${id}/mappa`)).rawPayload;

    expect((await pixel(await immagine(), ...SEGRETO))[3]).toBe(0);
    // Il Sacrario confina con il passaggio: scoprirlo non deve rivelare il segreto.
    await scopri(id, 'sala3');
    const soloSacrario = await immagine();
    expect((await pixel(soloSacrario, ...NEL_SACRARIO))[0]).toBeGreaterThan(240);
    expect((await pixel(soloSacrario, ...SEGRETO))[3]).toBe(0);

    await scopri(id, 'passaggio');
    const conPassaggio = await immagine();
    expect((await pixel(conPassaggio, ...SEGRETO)).slice(0, 3)).toEqual([17, 17, 17]);
    expect((await pixel(conPassaggio, ...NEL_SACRARIO)).slice(0, 3)).toEqual([17, 17, 17]);

    // Ricoperta la zona, il segreto sparisce di nuovo.
    await scopri(id, 'passaggio', false);
    expect((await pixel(await immagine(), ...SEGRETO))[3]).toBe(0);
  });
});
