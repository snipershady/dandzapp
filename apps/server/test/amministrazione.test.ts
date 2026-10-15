import { RispostaElencoUtenti, RispostaUtenteAmministrato } from '@dandzapp/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { modificaUtente } from '../src/utenti/amministrazione.ts';
import { creaOPromuoviMaster } from '../src/utenti/master.ts';
import { creaContesto, io, registra, type Contesto } from './aiuti.ts';

let ctx: Contesto;
let master: string;
let masterId: number;
beforeEach(async () => {
  ctx = await creaContesto();
  master = await registra(ctx.app, { email: 'master@esempio.it', nome: 'Zeta Master' });
  masterId = (await creaOPromuoviMaster(ctx.db, { email: 'master@esempio.it', nome: '' })).utente
    .id;
});
afterEach(() => ctx.chiudi());

const elenco = (token: string, cerca = '') =>
  ctx.app.inject({
    method: 'GET',
    url: '/api/amministrazione/utenti',
    query: cerca ? { cerca } : {},
    cookies: { sessione: token },
  });

const modifica = (token: string, id: number | string, payload: object) =>
  ctx.app.inject({
    method: 'PATCH',
    url: `/api/amministrazione/utenti/${id}`,
    payload,
    cookies: { sessione: token },
  });

async function idDi(email: string): Promise<number> {
  const riga = await ctx.db
    .selectFrom('utenti')
    .select('id')
    .where('email', '=', email)
    .executeTakeFirstOrThrow();
  return riga.id;
}

describe('permessi', () => {
  it('senza accesso: 401', async () => {
    const r = await ctx.app.inject({ method: 'GET', url: '/api/amministrazione/utenti' });
    expect(r.statusCode).toBe(401);
  });

  it('un ROLE_PLAYER non vede né modifica nulla: 403', async () => {
    const giocatore = await registra(ctx.app, { email: 'irene@esempio.it' });
    expect((await elenco(giocatore)).statusCode).toBe(403);

    const r = await modifica(giocatore, await idDi('irene@esempio.it'), { ruolo: 'ROLE_MASTER' });
    expect(r.statusCode).toBe(403);
    expect((await io(ctx.app, giocatore)).json().utente.ruolo).toBe('ROLE_PLAYER');
  });
});

describe('elenco', () => {
  it('mostra gli utenti ordinati per nome, senza hash delle password', async () => {
    await registra(ctx.app, { email: 'irene@esempio.it', nome: 'Irene' });
    await registra(ctx.app, { email: 'fabio@esempio.it', nome: 'Fabio' });

    const r = await elenco(master);
    expect(r.statusCode).toBe(200);
    expect(r.body).not.toContain('argon2');
    const { utenti, totale } = RispostaElencoUtenti.parse(r.json());
    expect(totale).toBe(3);
    expect(utenti.map((u) => u.nome)).toEqual(['Fabio', 'Irene', 'Zeta Master']);
    expect(utenti[0]).toMatchObject({ ruolo: 'ROLE_PLAYER', attivo: true, haPassword: true });
  });

  it('cerca per nome o email, trattando % e _ come testo', async () => {
    await registra(ctx.app, { email: 'irene@esempio.it', nome: 'Irene' });
    await registra(ctx.app, { email: 'fabio@altro.it', nome: 'Fabio_50%' });

    const perEmail = RispostaElencoUtenti.parse((await elenco(master, 'altro.it')).json());
    expect(perEmail.utenti.map((u) => u.nome)).toEqual(['Fabio_50%']);

    const perNome = RispostaElencoUtenti.parse((await elenco(master, 'IRE')).json());
    expect(perNome.utenti.map((u) => u.nome)).toEqual(['Irene']);

    const jolly = RispostaElencoUtenti.parse((await elenco(master, '%')).json());
    expect(jolly.utenti.map((u) => u.nome)).toEqual(['Fabio_50%']);
  });
});

describe('modifica', () => {
  it('promuove un giocatore a Master, con effetto immediato sulla sua sessione', async () => {
    const giocatore = await registra(ctx.app, { email: 'irene@esempio.it' });
    const r = await modifica(master, await idDi('irene@esempio.it'), { ruolo: 'ROLE_MASTER' });

    expect(r.statusCode).toBe(200);
    expect(RispostaUtenteAmministrato.parse(r.json()).utente.ruolo).toBe('ROLE_MASTER');
    expect((await io(ctx.app, giocatore)).json().utente.ruolo).toBe('ROLE_MASTER');
  });

  it('riporta un Master a giocatore se resta un altro Master', async () => {
    await registra(ctx.app, { email: 'irene@esempio.it' });
    const id = await idDi('irene@esempio.it');
    await modifica(master, id, { ruolo: 'ROLE_MASTER' });

    const r = await modifica(master, id, { ruolo: 'ROLE_PLAYER' });
    expect(r.statusCode).toBe(200);
    expect(r.json().utente.ruolo).toBe('ROLE_PLAYER');
  });

  it('disattivare chiude le sessioni; riattivare permette di accedere di nuovo', async () => {
    const giocatore = await registra(ctx.app, { email: 'irene@esempio.it' });
    const id = await idDi('irene@esempio.it');

    const disattiva = await modifica(master, id, { attivo: false });
    expect(disattiva.json().utente.attivo).toBe(false);
    expect((await io(ctx.app, giocatore)).statusCode).toBe(401);
    const sessioni = await ctx.db
      .selectFrom('sessioni')
      .selectAll()
      .where('utente_id', '=', id)
      .execute();
    expect(sessioni).toHaveLength(0);

    await modifica(master, id, { attivo: true });
    const accesso = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/accesso',
      payload: { email: 'irene@esempio.it', password: 'una-password-lunga' },
    });
    expect(accesso.statusCode).toBe(200);
  });

  it('non si può modificare il proprio account', async () => {
    const r = await modifica(master, masterId, { ruolo: 'ROLE_PLAYER' });
    expect(r.statusCode).toBe(409);
    expect((await io(ctx.app, master)).json().utente.ruolo).toBe('ROLE_MASTER');
  });

  it('non lascia mai il sistema senza un Master attivo', async () => {
    // Situazione raggiungibile solo con richieste simultanee: la si simula chiamando
    // il servizio con un altro attore.
    await registra(ctx.app, { email: 'irene@esempio.it' });
    const altroId = await idDi('irene@esempio.it');

    await expect(
      modificaUtente(ctx.db, {
        attoreId: altroId,
        bersaglioId: masterId,
        modifiche: { attivo: false },
      }),
    ).rejects.toThrow('Deve restare almeno un Master attivo');
    await expect(
      modificaUtente(ctx.db, {
        attoreId: altroId,
        bersaglioId: masterId,
        modifiche: { ruolo: 'ROLE_PLAYER' },
      }),
    ).rejects.toThrow('Deve restare almeno un Master attivo');
  });

  it('con due Master, due declassamenti simultanei ne lasciano comunque uno', async () => {
    await registra(ctx.app, { email: 'irene@esempio.it' });
    const ireneId = await idDi('irene@esempio.it');
    await modifica(master, ireneId, { ruolo: 'ROLE_MASTER' });

    const esiti = await Promise.allSettled([
      modificaUtente(ctx.db, {
        attoreId: masterId,
        bersaglioId: ireneId,
        modifiche: { ruolo: 'ROLE_PLAYER' },
      }),
      modificaUtente(ctx.db, {
        attoreId: ireneId,
        bersaglioId: masterId,
        modifiche: { ruolo: 'ROLE_PLAYER' },
      }),
    ]);
    expect(esiti.filter((e) => e.status === 'fulfilled')).toHaveLength(1);
    const masters = await ctx.db
      .selectFrom('utenti')
      .select('id')
      .where('ruolo', '=', 'ROLE_MASTER')
      .execute();
    expect(masters).toHaveLength(1);
  });

  it('valida identificativo e corpo della richiesta', async () => {
    expect((await modifica(master, 'abc', { attivo: false })).statusCode).toBe(400);
    expect((await modifica(master, 999_999, { attivo: false })).statusCode).toBe(404);
    expect((await modifica(master, masterId + 1, {})).statusCode).toBe(400);
    expect((await modifica(master, masterId, { ruolo: 'ROLE_ADMIN' })).statusCode).toBe(400);
    expect((await modifica(master, masterId, { email: 'x@y.it' })).statusCode).toBe(400);
  });
});
