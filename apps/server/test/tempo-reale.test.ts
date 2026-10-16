import { mkdtemp, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  EventiDalClient,
  EventiDalServer,
  EventoPartita,
  PresenteAlTavolo,
  RispostaComando,
  RispostaEntra,
  RispostaIstantanea,
} from '@dandzapp/shared';
import { io as ioClient, type Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { importaAvventura } from '../src/avventure/importa.ts';
import { creaOPromuoviMaster } from '../src/utenti/master.ts';
import { creaContesto, registra, type Contesto } from './aiuti.ts';

type Client = Socket<EventiDalServer, EventiDalClient>;

const SESSIONE_0 = fileURLToPath(new URL('../../../avventure/sessione-0', import.meta.url));

let ctx: Contesto;
let temporanea: string;
let indirizzo: string;
let master: string;
let partitaId: number;
const aperti: Client[] = [];

beforeEach(async () => {
  temporanea = await mkdtemp(path.join(tmpdir(), 'dandzapp-tr-'));
  // Le immagini dell'avventura (e le mappe composte) stanno nella cartella temporanea.
  ctx = await creaContesto({ cartellaDati: temporanea });
  await importaAvventura(ctx.db, { cartella: SESSIONE_0, cartellaDati: temporanea });
  await ctx.app.listen({ host: '127.0.0.1', port: 0 });
  indirizzo = `http://127.0.0.1:${(ctx.app.server.address() as AddressInfo).port}`;

  master = await registra(ctx.app, { email: 'marco@esempio.it', nome: 'Marco' });
  await creaOPromuoviMaster(ctx.db, { email: 'marco@esempio.it', nome: '' });
  const r = await chiama(master, 'POST', '/api/partite', {
    titolo: 'Il santuario sepolto',
    avventura: 'sessione-0',
  });
  partitaId = r.json().id as number;
});

afterEach(async () => {
  for (const s of aperti.splice(0)) s.disconnect();
  await ctx.chiudi();
  await rm(temporanea, { recursive: true, force: true });
});

const chiama = (
  token: string | null,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  payload?: object,
) =>
  ctx.app.inject({
    method,
    url,
    ...(payload ? { payload } : {}),
    ...(token ? { cookies: { sessione: token } } : {}),
  });

/** Client collegato con la sessione indicata (o senza), via WebSocket. */
function collega(token: string | null, origine?: string): Client {
  const headers: Record<string, string> = {};
  if (token) headers['cookie'] = `sessione=${token}`;
  if (origine) headers['origin'] = origine;
  const s: Client = ioClient(indirizzo, {
    path: '/socket.io',
    transports: ['websocket'],
    extraHeaders: headers,
    reconnection: false,
    forceNew: true,
  });
  aperti.push(s);
  return s;
}

const errore = (s: Client) =>
  new Promise<string>((ok) => s.once('connect_error', (e) => ok(e.message)));
const connesso = (s: Client) => new Promise<void>((ok) => s.once('connect', () => ok()));

/** Primo evento del tipo indicato, o errore dopo `ms`. */
function prossimo<E extends keyof EventiDalServer>(
  s: Client,
  evento: E,
  ms = 2000,
): Promise<Parameters<EventiDalServer[E]>> {
  return new Promise((ok, ko) => {
    const timer = setTimeout(() => ko(new Error(`Nessun evento ${evento} in ${ms} ms`)), ms);
    s.once(evento, ((...args: Parameters<EventiDalServer[E]>) => {
      clearTimeout(timer);
      ok(args);
    }) as never);
  });
}

/** Raccoglie gli eventi di un tipo per poter verificare anche che NON arrivino. */
function registro<E extends keyof EventiDalServer>(s: Client, evento: E) {
  const ricevuti: Parameters<EventiDalServer[E]>[] = [];
  s.on(evento, ((...args: Parameters<EventiDalServer[E]>) => ricevuti.push(args)) as never);
  return ricevuti;
}

const entra = (s: Client, id = partitaId) =>
  new Promise<RispostaEntra>((ok) => s.emit('partita:entra', id, ok));

const attendi = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

/** Giocatore invitato e già dentro la partita. */
async function giocatore(email: string, ruolo: 'giocatore' | 'osservatore' = 'giocatore') {
  const token = await registra(ctx.app, { email, nome: email.split('@')[0] ?? 'x' });
  const invito = await chiama(master, 'POST', `/api/partite/${partitaId}/inviti`, { email, ruolo });
  const tokenInvito = (invito.json().link as string).split('/').at(-1);
  await chiama(token, 'POST', `/api/inviti/${tokenInvito}/accetta`);
  const id = (await chiama(token, 'GET', '/api/auth/io')).json().utente.id as number;
  return { token, id };
}

const nomi = (p: PresenteAlTavolo[]) => p.map((x) => `${x.nome}:${x.ruolo}`);

describe('collegamento', () => {
  it('senza sessione il collegamento viene rifiutato', async () => {
    expect(await errore(collega(null))).toBe('Devi accedere per continuare');
    expect(await errore(collega('token-inventato'))).toBe('Devi accedere per continuare');
  });

  it("rifiuta un collegamento da un'altra origine", async () => {
    const s = collega(master, 'https://sito-malevolo.example');
    await expect(errore(s)).resolves.toBeTruthy();
    expect(s.connected).toBe(false);
  });

  it('chi non partecipa non entra nella partita e non ne riceve gli eventi', async () => {
    const estraneo = await registra(ctx.app, { email: 'estraneo@esempio.it' });
    const s = collega(estraneo);
    await connesso(s);
    expect(await entra(s)).toEqual({ ok: false, errore: 'Partita non trovata' });
    expect(await entra(s, 99999)).toEqual({ ok: false, errore: 'Partita non trovata' });
    const eventi = registro(s, 'partita:evento');
    await chiama(master, 'POST', `/api/partite/${partitaId}/personaggi`, { nome: 'S', sigla: 'S' });
    await attendi(200);
    expect(eventi).toEqual([]);
  });
});

describe('istantanea e versione', () => {
  it("all'ingresso arriva lo stato della partita filtrato per ruolo", async () => {
    const irene = await giocatore('irene@esempio.it');
    await chiama(master, 'POST', `/api/partite/${partitaId}/inviti`, { email: 'fabio@esempio.it' });

    const sm = collega(master);
    const si = collega(irene.token);
    const [rm_, ri] = [await entra(sm), await entra(si)];
    if (!rm_.ok || !ri.ok) throw new Error('ingresso fallito');
    expect(rm_.istantanea.dettaglio.inviti?.map((i) => i.email)).toEqual(['fabio@esempio.it']);
    expect(ri.istantanea.dettaglio.inviti).toBeUndefined();
    expect(ri.istantanea.versione).toBe(rm_.istantanea.versione);
  });

  it('ogni modifica incrementa la versione e arriva a tutti i collegati', async () => {
    const irene = await giocatore('irene@esempio.it');
    const si = collega(irene.token);
    const ri = await entra(si);
    if (!ri.ok) throw new Error('ingresso fallito');
    const prima = ri.istantanea.versione;

    const evento = prossimo(si, 'partita:evento');
    await chiama(master, 'POST', `/api/partite/${partitaId}/personaggi`, {
      nome: 'Shania',
      sigla: 'Sh',
      utenteId: irene.id,
    });
    const [e] = await evento;
    expect(e).toEqual<EventoPartita>({ versione: prima + 1, tipo: 'modificata' });

    const istantanea = await new Promise<Awaited<ReturnType<typeof entra>>>((ok) =>
      si.emit('partita:istantanea', ok as never),
    );
    expect(istantanea.ok && istantanea.istantanea.dettaglio.personaggi.map((p) => p.nome)).toEqual([
      'Shania',
    ]);
    const versione = await new Promise((ok) => si.emit('partita:versione', ok));
    expect(versione).toEqual({ ok: true, versione: prima + 1 });
  });

  it('le modifiche riservate al Master (inviti) non arrivano ai giocatori', async () => {
    const irene = await giocatore('irene@esempio.it');
    const sm = collega(master);
    const si = collega(irene.token);
    await entra(sm);
    await entra(si);
    const eventiIrene = registro(si, 'partita:evento');

    const perMaster = prossimo(sm, 'partita:evento');
    await chiama(master, 'POST', `/api/partite/${partitaId}/inviti`, { email: 'fabio@esempio.it' });
    await perMaster;
    await attendi(200);
    expect(eventiIrene).toEqual([]);
  });

  it('le partite sono isolate: gli eventi di una non arrivano all’altra', async () => {
    const altra = (
      await chiama(master, 'POST', '/api/partite', { titolo: 'Altra', avventura: 'sessione-0' })
    ).json().id as number;
    const s = collega(master);
    await entra(s, altra);
    const eventi = registro(s, 'partita:evento');
    await chiama(master, 'POST', `/api/partite/${partitaId}/personaggi`, { nome: 'S', sigla: 'S' });
    await attendi(200);
    expect(eventi).toEqual([]);
  });
});

describe('presenza "Al tavolo" (RF-80, RF-81)', () => {
  it('mostra chi ha la pagina aperta, con il ruolo; più schede contano una volta', async () => {
    const irene = await giocatore('irene@esempio.it');
    const oss = await giocatore('oss@esempio.it', 'osservatore');

    const sm = collega(master);
    await entra(sm);
    const scheda1 = collega(irene.token);
    const scheda2 = collega(irene.token);
    const so = collega(oss.token);
    await entra(scheda1);
    await entra(scheda2);
    const ultimo = prossimo(sm, 'partita:presenti');
    await entra(so);
    const [presenti] = await ultimo;
    expect(nomi(presenti)).toEqual(['irene:giocatore', 'Marco:master', 'oss:osservatore']);

    // Chiudendo una delle due schede Irene resta al tavolo; chiudendo l'altra se ne va.
    scheda1.disconnect();
    await attendi(200);
    const uscita = prossimo(sm, 'partita:presenti');
    scheda2.disconnect();
    expect(nomi((await uscita)[0])).toEqual(['Marco:master', 'oss:osservatore']);
  });

  it('un cambio di ruolo si vede subito nella presenza', async () => {
    const irene = await giocatore('irene@esempio.it');
    const sm = collega(master);
    const si = collega(irene.token);
    await entra(sm);
    await entra(si);
    const aggiornata = prossimo(sm, 'partita:presenti');
    await chiama(master, 'PATCH', `/api/partite/${partitaId}/partecipanti/${irene.id}`, {
      ruolo: 'osservatore',
    });
    expect(nomi((await aggiornata)[0])).toEqual(['irene:osservatore', 'Marco:master']);
  });
});

describe('uscite forzate', () => {
  it('chi viene tolto dalla partita riceve "espulso" e smette di ricevere eventi', async () => {
    const irene = await giocatore('irene@esempio.it');
    const si = collega(irene.token);
    await entra(si);
    const espulso = prossimo(si, 'partita:espulso');
    await chiama(master, 'DELETE', `/api/partite/${partitaId}/partecipanti/${irene.id}`);
    expect((await espulso)[0]).toBe('Il Master ti ha tolto dalla partita');

    const eventi = registro(si, 'partita:evento');
    await chiama(master, 'POST', `/api/partite/${partitaId}/personaggi`, { nome: 'S', sigla: 'S' });
    await attendi(200);
    expect(eventi).toEqual([]);
    expect(await new Promise((ok) => si.emit('partita:istantanea', ok))).toEqual({
      ok: false,
      errore: 'Non sei in una partita',
    });
  });

  it('eliminando la partita i collegati ricevono "eliminata"', async () => {
    const irene = await giocatore('irene@esempio.it');
    const si = collega(irene.token);
    await entra(si);
    const eliminata = prossimo(si, 'partita:eliminata');
    await chiama(master, 'DELETE', `/api/partite/${partitaId}`);
    await expect(eliminata).resolves.toEqual([]);
  });

  it("l'uscita (logout) chiude i collegamenti di quella sessione", async () => {
    const s = collega(master);
    await connesso(s);
    const chiuso = new Promise<void>((ok) => s.once('disconnect', () => ok()));
    await chiama(master, 'POST', '/api/auth/uscita');
    await chiuso;
    expect(s.connected).toBe(false);
  });

  it('disattivare un account ne chiude i collegamenti', async () => {
    const irene = await giocatore('irene@esempio.it');
    const si = collega(irene.token);
    await connesso(si);
    const chiuso = new Promise<void>((ok) => si.once('disconnect', () => ok()));
    await chiama(master, 'PATCH', `/api/amministrazione/utenti/${irene.id}`, { attivo: false });
    await chiuso;
  });
});

describe('pedine dei PG (RF-31, RF-34)', () => {
  const sposta = (s: Client, comando: { personaggioId: number; x: number; y: number }) =>
    new Promise<RispostaComando>((ok) => s.emit('pedina:sposta', comando, ok));
  const riporta = (s: Client) => new Promise<RispostaComando>((ok) => s.emit('pedine:riporta', ok));
  const posizioni = async () =>
    (await ctx.db.selectFrom('personaggi').select(['id', 'x', 'y']).orderBy('id').execute()).map(
      (p) => [p.x, p.y],
    );
  async function nuovoPg(nome: string, sigla: string, partita = partitaId): Promise<number> {
    const r = await chiama(master, 'POST', `/api/partite/${partita}/personaggi`, { nome, sigla });
    return r.json().id as number;
  }

  it('un giocatore sposta una pedina e tutti ricevono la posizione, con la versione successiva', async () => {
    const pg = await nuovoPg('Shania', 'Sh');
    const irene = await giocatore('irene@esempio.it');
    const [sm, si] = [collega(master), collega(irene.token)];
    const rm_ = await entra(sm);
    await entra(si);
    if (!rm_.ok) throw new Error('ingresso fallito');

    const evento = prossimo(sm, 'partita:evento');
    expect(await sposta(si, { personaggioId: pg, x: 600, y: 500 })).toEqual({ ok: true });
    const [e] = await evento;
    expect(e).toEqual({
      tipo: 'pedina:spostata',
      versione: rm_.istantanea.versione + 1,
      personaggioId: pg,
      x: 600,
      y: 500,
    });
    expect(await posizioni()).toEqual([[600, 500]]);
  });

  it('rifiuta osservatori, coordinate fuori mappa, PG di altre partite e partite archiviate', async () => {
    const pg = await nuovoPg('Shania', 'Sh');
    const altra = (
      await chiama(master, 'POST', '/api/partite', { titolo: 'Altra', avventura: 'sessione-0' })
    ).json().id as number;
    const pgAltra = await nuovoPg('Duronin', 'Du', altra);
    const irene = await giocatore('irene@esempio.it');
    const luca = await giocatore('luca@esempio.it', 'osservatore');
    const [si, sl] = [collega(irene.token), collega(luca.token)];
    await entra(si);
    await entra(sl);
    const prima = await posizioni();

    expect(await sposta(sl, { personaggioId: pg, x: 10, y: 10 })).toEqual({
      ok: false,
      errore: 'Partecipi in sola lettura',
    });
    expect(await sposta(si, { personaggioId: pg, x: 5000, y: 10 })).toEqual({
      ok: false,
      errore: 'La pedina deve restare sulla mappa',
    });
    expect(await sposta(si, { personaggioId: pg, x: -1, y: 10 })).toEqual({
      ok: false,
      errore: 'Comando non valido',
    });
    expect(await sposta(si, { personaggioId: pgAltra, x: 10, y: 10 })).toEqual({
      ok: false,
      errore: 'Personaggio non trovato',
    });
    await chiama(master, 'PATCH', `/api/partite/${partitaId}`, { stato: 'archiviata' });
    expect(await sposta(si, { personaggioId: pg, x: 10, y: 10 })).toMatchObject({ ok: false });
    expect(await posizioni()).toEqual(prima);
  });

  it('chi non è entrato nella partita non sposta nulla', async () => {
    const pg = await nuovoPg('Shania', 'Sh');
    const estraneo = await registra(ctx.app, { email: 'estraneo@esempio.it' });
    const s = collega(estraneo);
    await connesso(s);
    await entra(s);
    expect(await sposta(s, { personaggioId: pg, x: 10, y: 10 })).toEqual({
      ok: false,
      errore: 'Non sei in una partita',
    });
  });

  it('solo il Master riporta le pedine ai posti di partenza', async () => {
    const [sh, du] = [await nuovoPg('Shania', 'Sh'), await nuovoPg('Duronin', 'Du')];
    const partenza = await posizioni();
    const irene = await giocatore('irene@esempio.it');
    const [sm, si] = [collega(master), collega(irene.token)];
    await entra(sm);
    await entra(si);
    await sposta(si, { personaggioId: sh, x: 100, y: 100 });
    await sposta(si, { personaggioId: du, x: 200, y: 200 });

    expect(await riporta(si)).toEqual({
      ok: false,
      errore: 'Solo il Master della partita può farlo',
    });
    const evento = prossimo(si, 'partita:evento');
    expect(await riporta(sm)).toEqual({ ok: true });
    expect((await evento)[0].tipo).toBe('modificata');
    expect(await posizioni()).toEqual(partenza);
  });
});

describe('nebbia di guerra (RF-22)', () => {
  const imposta = (s: Client, zonaId: string, scoperta: boolean) =>
    new Promise<RispostaComando>((ok) => s.emit('zona:imposta', { zonaId, scoperta }, ok));
  const scoperte = async () =>
    (
      await ctx.db
        .selectFrom('zone_scoperte')
        .select('zona_id')
        .where('partita_id', '=', partitaId)
        .orderBy('zona_id')
        .execute()
    ).map((r) => r.zona_id);

  it('il Master scopre una zona e i giocatori ricevono una mappa nuova', async () => {
    const irene = await giocatore('irene@esempio.it');
    const [sm, si] = [collega(master), collega(irene.token)];
    await entra(sm);
    const ri = await entra(si);
    if (!ri.ok) throw new Error('ingresso fallito');

    const evento = prossimo(si, 'partita:evento');
    expect(await imposta(sm, 'sala1', true)).toEqual({ ok: true });
    expect((await evento)[0]).toEqual({
      tipo: 'modificata',
      versione: ri.istantanea.versione + 1,
    });
    expect(await scoperte()).toEqual(['ingresso', 'sala1']);
    const dopo = await new Promise<RispostaIstantanea>((ok) => si.emit('partita:istantanea', ok));
    if (!dopo.ok) throw new Error('istantanea fallita');
    expect(dopo.istantanea.dettaglio.mappa.chiave).not.toBe(ri.istantanea.dettaglio.mappa.chiave);
    expect(dopo.istantanea.dettaglio.zone).toBeUndefined();

    // Ripetere il comando non è un errore; togliendo la spunta la zona si ricopre.
    expect(await imposta(sm, 'sala1', true)).toEqual({ ok: true });
    expect(await imposta(sm, 'ingresso', false)).toEqual({ ok: true });
    expect(await scoperte()).toEqual(['sala1']);
  });

  it('giocatori e osservatori non toccano la nebbia; le zone devono esistere', async () => {
    const irene = await giocatore('irene@esempio.it');
    const luca = await giocatore('luca@esempio.it', 'osservatore');
    const [sm, si, sl] = [collega(master), collega(irene.token), collega(luca.token)];
    await entra(sm);
    await entra(si);
    await entra(sl);

    const vietato = { ok: false, errore: 'Solo il Master della partita può farlo' };
    expect(await imposta(si, 'sala3', true)).toEqual(vietato);
    expect(await imposta(sl, 'sala3', true)).toEqual(vietato);
    expect(await imposta(sm, 'stanza_inventata', true)).toEqual({
      ok: false,
      errore: 'Zona inesistente',
    });
    expect(await imposta(sm, '', true)).toEqual({ ok: false, errore: 'Comando non valido' });
    expect(await scoperte()).toEqual(['ingresso']);
  });
});

describe('mostri (RF-40…RF-44)', () => {
  type Cmd = Parameters<EventiDalClient['mostri:aggiungi']>[0];
  const aggiungi = (s: Client, c: Cmd) =>
    new Promise<RispostaComando>((ok) => s.emit('mostri:aggiungi', c, ok));
  const spostaM = (s: Client, mostroId: number, x: number, y: number) =>
    new Promise<RispostaComando>((ok) => s.emit('mostro:sposta', { mostroId, x, y }, ok));
  const togli = (s: Client, mostroId: number) =>
    new Promise<RispostaComando>((ok) => s.emit('mostro:togli', { mostroId }, ok));
  const togliTutti = (s: Client) =>
    new Promise<RispostaComando>((ok) => s.emit('mostri:togli-tutti', ok));
  const istantanea = async (s: Client) => {
    const r = await new Promise<RispostaIstantanea>((ok) => s.emit('partita:istantanea', ok));
    if (!r.ok) throw new Error(r.errore);
    return r.istantanea.dettaglio;
  };
  const imposta = (s: Client, zonaId: string, scoperta: boolean) =>
    new Promise<RispostaComando>((ok) => s.emit('zona:imposta', { zonaId, scoperta }, ok));

  async function tavolo() {
    const irene = await giocatore('irene@esempio.it');
    const [sm, si] = [collega(master), collega(irene.token)];
    await entra(sm);
    await entra(si);
    return { sm, si };
  }

  it('il Master li aggiunge con sigle numerate che proseguono', async () => {
    const { sm } = await tavolo();
    expect(await aggiungi(sm, { tipo: 'St', quantita: 3, zonaId: 'sala3' })).toEqual({ ok: true });
    const prima = (await istantanea(sm)).mostri;
    expect(prima.map((m) => m.sigla)).toEqual(['St1', 'St2', 'St3']);
    expect(prima.every((m) => m.nome === 'Stirge')).toBe(true);

    // Tolto l'ultimo, i nuovi non riusano la sua sigla.
    await togli(sm, prima[2]?.id ?? 0);
    await aggiungi(sm, { tipo: 'St', quantita: 2, zonaId: 'sala3' });
    await aggiungi(sm, { altro: 'Bandito', quantita: 1, zonaId: 'sala1' });
    const dopo = await istantanea(sm);
    expect(dopo.mostri.map((m) => m.sigla)).toEqual(['St1', 'St2', 'St4', 'St5', 'Ba1']);
    expect(dopo.tipiMostro?.map((t) => t.sigla)).toEqual(['Sc', 'Sp', 'St', 'Ga']);
  });

  it('i giocatori non ricevono i mostri delle zone coperte, né eventi su di loro', async () => {
    const { sm, si } = await tavolo();
    const eventiIrene = registro(si, 'partita:evento');
    await aggiungi(sm, { tipo: 'Sc', quantita: 2, zonaId: 'sala3' });
    const [sc1] = (await istantanea(sm)).mostri;
    await spostaM(sm, sc1?.id ?? 0, 400, 100);
    await attendi(200);
    expect(eventiIrene).toEqual([]);
    const vista = await istantanea(si);
    expect(vista.mostri).toEqual([]);
    expect(vista.tipiMostro).toBeUndefined();

    // Scoperta la zona, i mostri arrivano con l'istantanea.
    await imposta(sm, 'sala3', true);
    expect((await istantanea(si)).mostri.map((m) => m.sigla)).toEqual(['Sc1', 'Sc2']);

    // Un mostro portato nella roccia sparisce per i giocatori (e loro se ne accorgono).
    const evento = prossimo(si, 'partita:evento');
    await spostaM(sm, sc1?.id ?? 0, 100, 100);
    expect((await evento)[0].tipo).toBe('modificata');
    expect((await istantanea(si)).mostri.map((m) => m.sigla)).toEqual(['Sc2']);
  });

  it('il Master riceve la posizione salvata con un evento', async () => {
    const { sm } = await tavolo();
    await aggiungi(sm, { tipo: 'Ga', quantita: 1, zonaId: 'sala1' });
    const [ga] = (await istantanea(sm)).mostri;
    const evento = prossimo(sm, 'partita:evento');
    await spostaM(sm, ga?.id ?? 0, 500, 500);
    expect((await evento)[0]).toMatchObject({
      tipo: 'mostro:spostato',
      mostroId: ga?.id,
      x: 500,
      y: 500,
    });
  });

  it('il Master li toglie tutti', async () => {
    const { sm } = await tavolo();
    await aggiungi(sm, { tipo: 'Sp', quantita: 4, zonaId: 'ingresso' });
    expect(await togliTutti(sm)).toEqual({ ok: true });
    expect((await istantanea(sm)).mostri).toEqual([]);
  });

  it('i giocatori non toccano i mostri; tipi, zone e quantità sono controllati', async () => {
    const { sm, si } = await tavolo();
    await aggiungi(sm, { tipo: 'St', quantita: 1, zonaId: 'ingresso' });
    const [st] = (await istantanea(sm)).mostri;
    const vietato = { ok: false, errore: 'Solo il Master della partita può farlo' };
    expect(await aggiungi(si, { tipo: 'St', quantita: 1, zonaId: 'ingresso' })).toEqual(vietato);
    expect(await spostaM(si, st?.id ?? 0, 10, 10)).toEqual(vietato);
    expect(await togli(si, st?.id ?? 0)).toEqual(vietato);
    expect(await togliTutti(si)).toEqual(vietato);

    const nonValido = { ok: false, errore: 'Comando non valido' };
    expect(await aggiungi(sm, { tipo: 'St', quantita: 13, zonaId: 'ingresso' })).toEqual(nonValido);
    expect(await aggiungi(sm, { quantita: 1, zonaId: 'ingresso' })).toEqual(nonValido);
    expect(await aggiungi(sm, { tipo: 'Dr', quantita: 1, zonaId: 'ingresso' })).toEqual({
      ok: false,
      errore: 'Tipo di mostro inesistente',
    });
    expect(await aggiungi(sm, { tipo: 'St', quantita: 1, zonaId: 'boh' })).toEqual({
      ok: false,
      errore: 'Zona inesistente',
    });
    expect(await spostaM(sm, st?.id ?? 0, 99999, 10)).toEqual({
      ok: false,
      errore: 'Il mostro deve restare sulla mappa',
    });
    expect(await togli(sm, 999999)).toEqual({ ok: false, errore: 'Mostro non trovato' });
    expect((await istantanea(sm)).mostri).toHaveLength(1);
  });
});
