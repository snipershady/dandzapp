import {
  ComandoAggiungiMostri,
  ComandoSpostaMostro,
  ComandoNarrazione,
  ComandoPubblicaNarrazione,
  ComandoSpostaPedina,
  ComandoTira,
  ComandoTogliMostro,
  ComandoZona,
  type EventiDalClient,
  type EventiDalServer,
  type EventoPartita,
  type Istantanea,
  type Narrazione,
  type PresenteAlTavolo,
  type RispostaComando,
  type RuoloInPartita,
} from '@dandzapp/shared';
import type { FastifyInstance } from 'fastify';
import { Server, type Socket } from 'socket.io';
import { z } from 'zod';
import { COOKIE_SESSIONE } from '../auth/plugin.ts';
import { utenteDaSessione } from '../auth/sessioni.ts';
import { hashToken } from '../auth/token.ts';
import type { Config } from '../config.ts';
import type { Db } from '../db/database.ts';
import type { RigaUtente } from '../db/schema.ts';
import { ErroreHttp } from '../http/errori.ts';
import { accessoPartita } from '../partite/accesso.ts';
import { dettaglioPartita } from '../partite/partite.ts';
import { aggiungiMostri, spostaMostro, togliMostro, togliTuttiIMostri } from '../partite/mostri.ts';
import {
  eliminaNarrazione,
  nascondiNarrazione,
  pubblicaNarrazione,
  ripubblicaNarrazione,
} from '../partite/narrazione.ts';
import { impostaZona } from '../partite/nebbia.ts';
import { svuotaTiri, tira } from '../partite/tiri.ts';
import { riportaPedine, spostaPedina } from '../partite/pedine.ts';

/** `Omit` che rispetta le unioni: toglie la chiave da ciascun membro. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

type SenzaVersione = DistributiveOmit<EventoPartita, 'versione'>;

type DatiSocket = { utente: RigaUtente; tokenHash: string; partitaId: number | null };
type SocketTavolo = Socket<EventiDalClient, EventiDalServer, Record<string, never>, DatiSocket>;

/** Operazioni del tempo reale usate dalle rotte HTTP dopo ogni modifica. */
export type TempoReale = {
  /**
   * Incrementa la versione della partita e avvisa i collegati di riallinearsi.
   * Con `soloMaster` avvisa solo il Master (es. inviti, che i giocatori non vedono).
   */
  notifica(partitaId: number, opzioni?: { soloMaster?: boolean }): Promise<void>;
  /** Toglie un utente dalle stanze della partita (rimosso o uscito). */
  espelli(partitaId: number, utenteId: number, motivo: string): Promise<void>;
  partitaEliminata(partitaId: number): void;
  /** Chiude i collegamenti di una sessione (uscita) o di un utente (disattivato). */
  chiudiSessione(token: string): void;
  chiudiUtente(utenteId: number): void;
  chiudi(): Promise<void>;
};

const stanza = (partitaId: number) => `partita:${partitaId}`;
const stanzaMaster = (partitaId: number) => `partita:${partitaId}:master`;
const stanzaUtente = (utenteId: number) => `utente:${utenteId}`;
const stanzaSessione = (tokenHash: string) => `sessione:${tokenHash}`;

const IdPartita = z.number().int().positive();

export function avviaTempoReale(
  app: FastifyInstance,
  { config, db, ora }: { config: Config; db: Db; ora: () => Date },
): TempoReale {
  const origineApp = new URL(config.urlApp).origin;
  const io = new Server<EventiDalClient, EventiDalServer, Record<string, never>, DatiSocket>(
    app.server,
    {
      path: '/socket.io',
      serveClient: false,
      // Difesa dal "cross-site WebSocket hijacking": solo l'origine dell'app. Le richieste
      // di polling dalla stessa origine a volte non hanno Origin: si accettano.
      allowRequest: (req, consenti) => {
        const origine = req.headers.origin;
        consenti(null, origine === undefined || origine === origineApp);
      },
    },
  );

  // Autenticazione dell'handshake con lo stesso cookie di sessione dell'API.
  io.use(async (socket, avanti) => {
    try {
      const token = app.parseCookie(socket.request.headers.cookie ?? '')[COOKIE_SESSIONE];
      const utente = token ? await utenteDaSessione(db, token, ora()) : null;
      if (!token || !utente) return avanti(new Error('Devi accedere per continuare'));
      socket.data = { utente, tokenHash: hashToken(token), partitaId: null };
      await socket.join([stanzaUtente(utente.id), stanzaSessione(socket.data.tokenHash)]);
      avanti();
    } catch (e) {
      app.log.error(e, 'Errore nell’autenticazione del socket');
      avanti(new Error('Errore del server'));
    }
  });

  /** Presenti per partita: utente → socket aperti (più schede contano una volta, RF-81). */
  const presenze = new Map<number, Map<number, Set<string>>>();
  /** In chiusura il database può già essere chiuso: niente più annunci. */
  let inChiusura = false;

  async function presenti(partitaId: number): Promise<PresenteAlTavolo[]> {
    const ids = [...(presenze.get(partitaId)?.keys() ?? [])];
    if (ids.length === 0) return [];
    const partita = await db
      .selectFrom('partite')
      .select('master_id')
      .where('id', '=', partitaId)
      .executeTakeFirst();
    if (!partita) return [];
    const righe = await db
      .selectFrom('utenti')
      .leftJoin('partecipazioni', (j) =>
        j
          .onRef('partecipazioni.utente_id', '=', 'utenti.id')
          .on('partecipazioni.partita_id', '=', partitaId),
      )
      .select([
        'utenti.id',
        'utenti.nome',
        'utenti.avatar_url',
        'partecipazioni.ruolo',
        'partecipazioni.personaggio_id',
      ])
      .where('utenti.id', 'in', ids)
      .orderBy('utenti.nome')
      .execute();
    return righe.flatMap((r) => {
      const ruolo: RuoloInPartita | null = partita.master_id === r.id ? 'master' : r.ruolo;
      if (!ruolo) return [];
      return [
        {
          utenteId: r.id,
          nome: r.nome,
          avatarUrl: r.avatar_url,
          ruolo,
          personaggioId: r.personaggio_id,
        },
      ];
    });
  }

  async function annunciaPresenti(partitaId: number): Promise<void> {
    if (inChiusura) return;
    io.to(stanza(partitaId)).emit('partita:presenti', await presenti(partitaId));
  }

  /** I gestori degli eventi non devono mai lasciare promesse rifiutate senza gestione. */
  const inSicurezza = (p: Promise<unknown>) =>
    void p.catch((e: unknown) => app.log.error(e, 'Errore nel tempo reale'));

  function registraPresenza(partitaId: number, utenteId: number, socketId: string): void {
    const perPartita = presenze.get(partitaId) ?? new Map<number, Set<string>>();
    presenze.set(partitaId, perPartita);
    const sockets = perPartita.get(utenteId) ?? new Set<string>();
    perPartita.set(utenteId, sockets);
    sockets.add(socketId);
  }

  /** Toglie il socket dalla presenza; `true` se l'utente non ha più schede aperte. */
  function togliPresenza(partitaId: number, utenteId: number, socketId: string): boolean {
    const perPartita = presenze.get(partitaId);
    const sockets = perPartita?.get(utenteId);
    if (!perPartita || !sockets) return false;
    sockets.delete(socketId);
    if (sockets.size > 0) return false;
    perPartita.delete(utenteId);
    if (perPartita.size === 0) presenze.delete(partitaId);
    return true;
  }

  async function istantanea(partitaId: number, utenteId: number): Promise<Istantanea> {
    const { ruolo } = await accessoPartita(db, partitaId, utenteId);
    const dettaglio = await dettaglioPartita(db, partitaId, ruolo);
    return { versione: dettaglio.versione, dettaglio };
  }

  async function lascia(socket: SocketTavolo): Promise<void> {
    const partitaId = socket.data.partitaId;
    if (partitaId === null) return;
    socket.data.partitaId = null;
    await socket.leave(stanza(partitaId));
    await socket.leave(stanzaMaster(partitaId));
    if (togliPresenza(partitaId, socket.data.utente.id, socket.id)) {
      await annunciaPresenti(partitaId);
    }
  }

  const messaggio = (e: unknown) =>
    e instanceof ErroreHttp ? e.message : 'Errore del server: riprova';

  /**
   * Esegue `scrivi` e incrementa la versione della partita nella stessa transazione, con
   * la riga della partita bloccata: le versioni seguono l'ordine delle scritture, e i dati
   * di un evento sono proprio quelli della sua versione. Dopo il commit diffonde l'evento.
   */
  async function modifica<T>(
    partitaId: number,
    scrivi: (trx: Db) => Promise<T>,
    {
      soloMaster = false,
      evento = () => ({ tipo: 'modificata' }),
      perGiocatori,
    }: {
      soloMaster?: boolean;
      evento?: (risultato: T) => SenzaVersione;
      /**
       * Se indicato, `evento` va solo al Master e gli altri ricevono questo (o niente, con
       * `null`): così un evento con dati riservati non arriva mai ai giocatori.
       */
      perGiocatori?: (risultato: T) => SenzaVersione | null;
    } = {},
  ): Promise<T | null> {
    const esito = await db.transaction().execute(async (trx) => {
      const riga = await trx
        .selectFrom('partite')
        .select('versione')
        .where('id', '=', partitaId)
        .forUpdate()
        .executeTakeFirst();
      if (!riga) return null;
      const risultato = await scrivi(trx);
      const versione = Number(riga.versione) + 1;
      await trx
        .updateTable('partite')
        .set({ versione, aggiornata_il: ora() })
        .where('id', '=', partitaId)
        .execute();
      return { risultato, versione };
    });
    if (esito === null) return null;
    const { risultato, versione } = esito;
    // Chi non riceve l'evento (i giocatori, per le modifiche riservate al Master) vedrà
    // comunque un salto di versione alla prossima modifica e chiederà un'istantanea.
    const dati: EventoPartita = { ...evento(risultato), versione };
    if (soloMaster || perGiocatori) {
      io.to(stanzaMaster(partitaId)).emit('partita:evento', dati);
      const altri = perGiocatori?.(risultato);
      if (altri) {
        io.to(stanza(partitaId))
          .except(stanzaMaster(partitaId))
          .emit('partita:evento', { ...altri, versione });
      }
    } else {
      io.to(stanza(partitaId)).emit('partita:evento', dati);
    }
    return risultato;
  }

  /**
   * Comando di gioco da un socket: i permessi si ricontrollano a ogni comando (il ruolo
   * può essere cambiato nel frattempo), e una partita archiviata è in sola lettura.
   */
  async function comando(
    socket: SocketTavolo,
    risposta: unknown,
    chi: 'gioca' | 'master',
    /** Può restituire dati da aggiungere alla risposta (es. il tiro appena fatto). */
    azione: (partitaId: number, ruolo: RuoloInPartita) => Promise<object | void>,
  ): Promise<void> {
    const rispondi = (r: RispostaComando | (RispostaComando & object)) => {
      if (typeof risposta === 'function') risposta(r);
    };
    const partitaId = socket.data.partitaId;
    if (partitaId === null) return rispondi({ ok: false, errore: 'Non sei in una partita' });
    try {
      const { partita, ruolo } = await accessoPartita(db, partitaId, socket.data.utente.id);
      if (chi === 'master' && ruolo !== 'master') {
        throw new ErroreHttp(403, 'Solo il Master della partita può farlo');
      }
      if (ruolo === 'osservatore') throw new ErroreHttp(403, 'Partecipi in sola lettura');
      if (partita.stato === 'archiviata') {
        throw new ErroreHttp(409, 'La partita è archiviata: è in sola lettura');
      }
      const dati = await azione(partitaId, ruolo);
      rispondi({ ...dati, ok: true });
    } catch (e) {
      if (e instanceof z.ZodError) return rispondi({ ok: false, errore: 'Comando non valido' });
      if (!(e instanceof ErroreHttp)) app.log.error(e);
      rispondi({ ok: false, errore: messaggio(e) });
    }
  }

  io.on('connection', (socket) => {
    socket.on('partita:entra', async (id, risposta) => {
      try {
        const partitaId = IdPartita.parse(id);
        // Il controllo d'accesso è lo stesso dell'API: chi non partecipa riceve "non trovata".
        const { ruolo } = await accessoPartita(db, partitaId, socket.data.utente.id);
        await lascia(socket);
        socket.data.partitaId = partitaId;
        await socket.join(stanza(partitaId));
        if (ruolo === 'master') await socket.join(stanzaMaster(partitaId));
        registraPresenza(partitaId, socket.data.utente.id, socket.id);
        const stato = await istantanea(partitaId, socket.data.utente.id);
        await annunciaPresenti(partitaId);
        risposta({ ok: true, istantanea: stato, presenti: await presenti(partitaId) });
      } catch (e) {
        if (!(e instanceof ErroreHttp)) app.log.error(e);
        risposta({
          ok: false,
          errore: e instanceof z.ZodError ? 'Partita non valida' : messaggio(e),
        });
      }
    });

    socket.on('partita:istantanea', async (risposta) => {
      const partitaId = socket.data.partitaId;
      if (partitaId === null) return risposta({ ok: false, errore: 'Non sei in una partita' });
      try {
        risposta({ ok: true, istantanea: await istantanea(partitaId, socket.data.utente.id) });
      } catch (e) {
        if (!(e instanceof ErroreHttp)) app.log.error(e);
        risposta({ ok: false, errore: messaggio(e) });
      }
    });

    socket.on('partita:versione', async (risposta) => {
      const partitaId = socket.data.partitaId;
      if (partitaId === null) return risposta({ ok: false, errore: 'Non sei in una partita' });
      try {
        const { partita } = await accessoPartita(db, partitaId, socket.data.utente.id);
        risposta({ ok: true, versione: Number(partita.versione) });
      } catch (e) {
        risposta({ ok: false, errore: messaggio(e) });
      }
    });

    // Pedine dei PG (RF-31, RF-34): le muovono il Master e i giocatori, non gli osservatori.
    socket.on('pedina:sposta', (dati, risposta) =>
      inSicurezza(
        comando(socket, risposta, 'gioca', async (partitaId) => {
          const c = ComandoSpostaPedina.parse(dati);
          await modifica(partitaId, (trx) => spostaPedina(trx, partitaId, c), {
            evento: () => ({ tipo: 'pedina:spostata', ...c }),
          });
        }),
      ),
    );
    socket.on('pedine:riporta', (risposta) =>
      inSicurezza(
        comando(socket, risposta, 'master', async (partitaId) => {
          await modifica(partitaId, (trx) => riportaPedine(trx, partitaId));
        }),
      ),
    );

    // Nebbia (RF-22): solo il Master. Tutti si riallineano: ai giocatori arriva una mappa
    // con una nuova chiave, al Master lo stato aggiornato delle zone.
    socket.on('zona:imposta', (dati, risposta) =>
      inSicurezza(
        comando(socket, risposta, 'master', async (partitaId) => {
          const c = ComandoZona.parse(dati);
          await modifica(partitaId, (trx) => impostaZona(trx, partitaId, c));
        }),
      ),
    );

    // Mostri (RF-40…RF-44): solo il Master. I giocatori sono avvisati solo se la modifica
    // tocca un mostro che vedono (prima o dopo); altrimenti non sanno nemmeno che è successo.
    const seVisibile = (r: { visibile: boolean }) =>
      r.visibile ? ({ tipo: 'modificata' } as const) : null;
    socket.on('mostri:aggiungi', (dati, risposta) =>
      inSicurezza(
        comando(socket, risposta, 'master', async (partitaId) => {
          const c = ComandoAggiungiMostri.parse(dati);
          await modifica(partitaId, (trx) => aggiungiMostri(trx, partitaId, c), {
            perGiocatori: (r) => seVisibile({ visibile: r.visibili }),
          });
        }),
      ),
    );
    socket.on('mostro:sposta', (dati, risposta) =>
      inSicurezza(
        comando(socket, risposta, 'master', async (partitaId) => {
          const c = ComandoSpostaMostro.parse(dati);
          await modifica(partitaId, (trx) => spostaMostro(trx, partitaId, c), {
            evento: () => ({ tipo: 'mostro:spostato', ...c }),
            perGiocatori: seVisibile,
          });
        }),
      ),
    );
    socket.on('mostro:togli', (dati, risposta) =>
      inSicurezza(
        comando(socket, risposta, 'master', async (partitaId) => {
          const { mostroId } = ComandoTogliMostro.parse(dati);
          await modifica(partitaId, (trx) => togliMostro(trx, partitaId, mostroId), {
            perGiocatori: seVisibile,
          });
        }),
      ),
    );
    socket.on('mostri:togli-tutti', (risposta) =>
      inSicurezza(
        comando(socket, risposta, 'master', async (partitaId) => {
          await modifica(partitaId, (trx) => togliTuttiIMostri(trx, partitaId), {
            perGiocatori: seVisibile,
          });
        }),
      ),
    );

    // Dadi (RF-50…RF-63). Un tiro pubblico arriva a tutti con i dati; uno nascosto solo al
    // Master, e i giocatori non ne sanno nulla.
    socket.on('dadi:tira', (dati, risposta) =>
      inSicurezza(
        comando(socket, risposta, 'gioca', async (partitaId, ruolo) => {
          const c = ComandoTira.parse(dati);
          const utenteId = socket.data.utente.id;
          const tiro = await modifica(
            partitaId,
            (trx) => tira(trx, partitaId, utenteId, ruolo, c, ora()),
            {
              evento: (t) => ({ tipo: 'dado:tirato', tiro: t }),
              perGiocatori: (t) => (t.nascosto ? null : { tipo: 'dado:tirato', tiro: t }),
            },
          );
          return { tiro };
        }),
      ),
    );
    socket.on('tiri:svuota', (risposta) =>
      inSicurezza(
        comando(socket, risposta, 'master', async (partitaId) => {
          await modifica(partitaId, (trx) => svuotaTiri(trx, partitaId));
        }),
      ),
    );

    // Narrazione (RF-70): il Master si riallinea (cambia anche il suo storico dei testi),
    // gli altri ricevono subito il testo da mostrare.
    const narrazione = (
      evento: 'narrazione:pubblica' | 'narrazione:ripubblica' | 'narrazione:elimina',
      scrivi: (trx: Db, partitaId: number, dati: unknown) => Promise<Narrazione | null>,
    ) =>
      socket.on(evento, (dati: unknown, risposta: unknown) =>
        inSicurezza(
          comando(socket, risposta, 'master', async (partitaId) => {
            await modifica(partitaId, (trx) => scrivi(trx, partitaId, dati), {
              perGiocatori: (n) => ({ tipo: 'narrazione:cambiata', narrazione: n }),
            });
          }),
        ),
      );
    narrazione('narrazione:pubblica', (trx, id, dati) =>
      pubblicaNarrazione(trx, id, ComandoPubblicaNarrazione.parse(dati).testo, ora()),
    );
    narrazione('narrazione:ripubblica', (trx, id, dati) =>
      ripubblicaNarrazione(trx, id, ComandoNarrazione.parse(dati).narrazioneId, ora()),
    );
    narrazione('narrazione:elimina', (trx, id, dati) =>
      eliminaNarrazione(trx, id, ComandoNarrazione.parse(dati).narrazioneId),
    );
    socket.on('narrazione:nascondi', (risposta) =>
      inSicurezza(
        comando(socket, risposta, 'master', async (partitaId) => {
          await modifica(partitaId, (trx) => nascondiNarrazione(trx, partitaId), {
            perGiocatori: () => ({ tipo: 'narrazione:cambiata', narrazione: null }),
          });
        }),
      ),
    );

    socket.on('partita:esci', () => inSicurezza(lascia(socket)));
    socket.on('disconnecting', () => inSicurezza(lascia(socket)));
  });

  async function socketDellUtente(partitaId: number, utenteId: number) {
    const sockets = await io.in(stanzaUtente(utenteId)).fetchSockets();
    return sockets.filter((s) => s.data.partitaId === partitaId);
  }

  return {
    async notifica(partitaId, { soloMaster = false } = {}) {
      await modifica(partitaId, async () => true, { soloMaster });
      // Ruoli e "Giochi come" possono essere cambiati: si aggiorna anche la presenza.
      if (!soloMaster) await annunciaPresenti(partitaId);
    },

    async espelli(partitaId, utenteId, motivo) {
      for (const s of await socketDellUtente(partitaId, utenteId)) {
        s.emit('partita:espulso', motivo);
        s.leave(stanza(partitaId));
        s.leave(stanzaMaster(partitaId));
        s.data.partitaId = null;
        togliPresenza(partitaId, utenteId, s.id);
      }
      await annunciaPresenti(partitaId);
    },

    partitaEliminata(partitaId) {
      io.to(stanza(partitaId)).emit('partita:eliminata');
      io.in(stanza(partitaId)).socketsLeave([stanza(partitaId), stanzaMaster(partitaId)]);
      presenze.delete(partitaId);
    },

    chiudiSessione(token) {
      io.in(stanzaSessione(hashToken(token))).disconnectSockets(true);
    },

    chiudiUtente(utenteId) {
      io.in(stanzaUtente(utenteId)).disconnectSockets(true);
    },

    async chiudi() {
      inChiusura = true;
      await io.close();
    },
  };
}
