import { RispostaUtente } from '@dandzapp/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DURATA_RECUPERO_MS } from '../src/auth/recupero-password.ts';
import { DURATA_SESSIONE_MS } from '../src/auth/sessioni.ts';
import { creaContesto, io, PASSWORD, registra, tokenSessione, type Contesto } from './aiuti.ts';

let ctx: Contesto;
beforeEach(async () => {
  ctx = await creaContesto();
});
afterEach(() => ctx.chiudi());

const post = (url: string, payload: object, cookies: Record<string, string> = {}) =>
  ctx.app.inject({ method: 'POST', url, payload, cookies });

const accedi = (email: string, password: string) => post('/api/auth/accesso', { email, password });

describe('registrazione', () => {
  it('crea un ROLE_PLAYER, apre la sessione e non espone la password', async () => {
    const risposta = await post('/api/auth/registrazione', {
      email: ' Irene@Esempio.IT ',
      nome: 'Irene',
      password: PASSWORD,
    });

    expect(risposta.statusCode).toBe(201);
    const { utente } = RispostaUtente.parse(risposta.json());
    expect(utente).toMatchObject({
      email: 'irene@esempio.it',
      nome: 'Irene',
      ruolo: 'ROLE_PLAYER',
    });
    expect(risposta.body).not.toContain('password');

    const cookie = risposta.cookies.find((c) => c.name === 'sessione');
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' });

    const riga = await ctx.db
      .selectFrom('utenti')
      .select('password_hash')
      .executeTakeFirstOrThrow();
    expect(riga.password_hash).toMatch(/^\$argon2id\$/);
  });

  it('ignora un ruolo inviato dal client: non ci si registra come Master', async () => {
    const risposta = await post('/api/auth/registrazione', {
      email: 'furbo@esempio.it',
      nome: 'Furbo',
      password: PASSWORD,
      ruolo: 'ROLE_MASTER',
    });
    expect(RispostaUtente.parse(risposta.json()).utente.ruolo).toBe('ROLE_PLAYER');
  });

  it("rifiuta un'email già registrata, anche con maiuscole diverse", async () => {
    await registra(ctx.app, { email: 'fabio@esempio.it' });
    const risposta = await post('/api/auth/registrazione', {
      email: 'FABIO@esempio.it',
      nome: 'Fabio',
      password: PASSWORD,
    });
    expect(risposta.statusCode).toBe(409);
    expect(risposta.json().campi).toHaveProperty('email');
  });

  it('segnala in italiano ogni campo non valido', async () => {
    const risposta = await post('/api/auth/registrazione', {
      email: 'x',
      nome: '',
      password: 'corta',
    });
    expect(risposta.statusCode).toBe(400);
    expect(risposta.json()).toEqual({
      errore: 'Controlla i dati inseriti',
      campi: {
        email: 'Email non valida',
        nome: 'Il nome deve avere almeno 2 caratteri',
        password: 'La password deve avere almeno 10 caratteri',
      },
    });
  });
});

describe('accesso e uscita', () => {
  it('accede con le credenziali giuste e /io restituisce l’utente', async () => {
    await registra(ctx.app, { email: 'enzo@esempio.it', nome: 'Enzo' });
    const risposta = await accedi('enzo@esempio.it', PASSWORD);
    expect(risposta.statusCode).toBe(200);

    const profilo = await io(ctx.app, tokenSessione(risposta));
    expect(profilo.statusCode).toBe(200);
    expect(RispostaUtente.parse(profilo.json()).utente.nome).toBe('Enzo');
  });

  it('dà lo stesso errore per password sbagliata ed email inesistente', async () => {
    await registra(ctx.app, { email: 'lara@esempio.it' });
    const sbagliata = await accedi('lara@esempio.it', 'password-sbagliata');
    const inesistente = await accedi('nessuno@esempio.it', PASSWORD);

    expect(sbagliata.statusCode).toBe(401);
    expect(inesistente.statusCode).toBe(401);
    expect(sbagliata.json()).toEqual(inesistente.json());
  });

  it('blocca un account disattivato e ne invalida le sessioni', async () => {
    const token = await registra(ctx.app, { email: 'luca@esempio.it' });
    await ctx.db.updateTable('utenti').set({ attivo: false }).execute();

    expect((await io(ctx.app, token)).statusCode).toBe(401);
    expect((await accedi('luca@esempio.it', PASSWORD)).statusCode).toBe(403);
  });

  it('limita i tentativi di accesso ripetuti', async () => {
    const codici: number[] = [];
    for (let i = 0; i < 11; i++)
      codici.push((await accedi('x@esempio.it', 'tentativo')).statusCode);
    expect(codici.slice(0, 10).every((c) => c === 401)).toBe(true);
    expect(codici[10]).toBe(429);
  });

  it("l'uscita chiude la sessione", async () => {
    const token = await registra(ctx.app, { email: 'gianluca@esempio.it' });
    const uscita = await post('/api/auth/uscita', {}, { sessione: token });
    expect(uscita.statusCode).toBe(204);
    expect((await io(ctx.app, token)).statusCode).toBe(401);
  });

  it('una sessione scade dopo 30 giorni', async () => {
    const token = await registra(ctx.app, { email: 'marta@esempio.it' });
    ctx.avanza(DURATA_SESSIONE_MS + 1000);
    expect((await io(ctx.app, token)).statusCode).toBe(401);
  });

  it('senza cookie /io risponde 401, con un token inventato pure', async () => {
    expect((await ctx.app.inject({ method: 'GET', url: '/api/auth/io' })).statusCode).toBe(401);
    expect((await io(ctx.app, 'token-inventato')).statusCode).toBe(401);
  });
});

describe('protezione CSRF', () => {
  it("rifiuta le richieste che modificano dati da un'altra origine", async () => {
    const risposta = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/registrazione',
      headers: { origin: 'https://sito-malevolo.example' },
      payload: { email: 'a@esempio.it', nome: 'Aldo', password: PASSWORD },
    });
    expect(risposta.statusCode).toBe(403);
  });

  it("accetta l'origine dell'applicazione", async () => {
    const risposta = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/registrazione',
      headers: { origin: ctx.config.urlApp },
      payload: { email: 'a@esempio.it', nome: 'Aldo', password: PASSWORD },
    });
    expect(risposta.statusCode).toBe(201);
  });
});

describe('recupero password', () => {
  const linkDallEmail = () => {
    const testo = ctx.posta.at(-1)?.testo ?? '';
    const token = /reimposta-password\?token=([\w-]+)/.exec(testo)?.[1];
    if (!token) throw new Error('Nessun link nella posta');
    return token;
  };

  it("risponde allo stesso modo che l'email esista o no, ma scrive solo se esiste", async () => {
    await registra(ctx.app, { email: 'irene@esempio.it' });
    const esiste = await post('/api/auth/password-dimenticata', { email: 'irene@esempio.it' });
    const nonEsiste = await post('/api/auth/password-dimenticata', { email: 'ignoto@esempio.it' });

    expect(esiste.statusCode).toBe(202);
    expect(nonEsiste.statusCode).toBe(202);
    expect(esiste.json()).toEqual(nonEsiste.json());
    expect(ctx.posta).toHaveLength(1);
    expect(ctx.posta[0]?.a).toBe('irene@esempio.it');
  });

  it('il link imposta la nuova password, chiude le vecchie sessioni e vale una volta sola', async () => {
    const vecchiaSessione = await registra(ctx.app, { email: 'irene@esempio.it' });
    await post('/api/auth/password-dimenticata', { email: 'irene@esempio.it' });
    const token = linkDallEmail();

    const reimposta = await post('/api/auth/reimposta-password', {
      token,
      password: 'nuova-password-sicura',
    });
    expect(reimposta.statusCode).toBe(200);
    expect((await io(ctx.app, tokenSessione(reimposta))).statusCode).toBe(200);
    expect((await io(ctx.app, vecchiaSessione)).statusCode).toBe(401);

    expect((await accedi('irene@esempio.it', PASSWORD)).statusCode).toBe(401);
    expect((await accedi('irene@esempio.it', 'nuova-password-sicura')).statusCode).toBe(200);

    const diNuovo = await post('/api/auth/reimposta-password', {
      token,
      password: 'altra-password-ancora',
    });
    expect(diNuovo.statusCode).toBe(400);
  });

  it('il link scade dopo un’ora', async () => {
    await registra(ctx.app, { email: 'irene@esempio.it' });
    await post('/api/auth/password-dimenticata', { email: 'irene@esempio.it' });
    ctx.avanza(DURATA_RECUPERO_MS + 1000);

    const risposta = await post('/api/auth/reimposta-password', {
      token: linkDallEmail(),
      password: 'nuova-password-sicura',
    });
    expect(risposta.statusCode).toBe(400);
  });
});
