import {
  DettaglioPartita,
  type EventiDalClient,
  type EventiDalServer,
  type Istantanea,
  type PresenteAlTavolo,
} from '@dandzapp/shared';
import { io, type Socket } from 'socket.io-client';
import { api, ErroreApi } from '#lib/api.ts';

export type StatoCollegamento = 'collegamento' | 'collegato' | 'riconnessione' | 'scollegato';

/** Ogni quanto si ricontrolla la versione anche con il collegamento attivo. */
const CONTROLLO_MS = 15_000;
/** Ogni quanto si interroga l'API quando il tempo reale non funziona (RF-91). */
const RIPIEGO_MS = 5_000;
/** Oltre questo tempo senza collegamento si passa al ripiego, anche senza errori. */
const ATTESA_MAX_MS = 4_000;

/**
 * Collegamento in tempo reale a una partita (§15.3, RF-90…RF-92).
 *
 * - All'ingresso riceve un'istantanea filtrata dal server, poi gli eventi numerati.
 * - Se la versione di un evento non è la successiva attesa, chiede una nuova istantanea.
 * - Ricontrolla la versione a intervalli regolari: un evento perso non resta tale.
 * - Se il collegamento cade, interroga l'API ogni pochi secondi finché non torna.
 */
export class Collegamento {
  stato = $state<StatoCollegamento>('collegamento');
  dettaglio = $state<DettaglioPartita>() as DettaglioPartita;
  presenti = $state<PresenteAlTavolo[]>([]);
  /** Istante dell'ultimo allineamento con il server (millisecondi). */
  ultimoAggiornamento = $state(Date.now());
  errore = $state<string | null>(null);
  /** Motivo per cui la partita non è più accessibile (espulsione, eliminazione). */
  chiusura = $state<string | null>(null);

  #socket: Socket<EventiDalServer, EventiDalClient> | null = null;
  #partitaId: number;
  #timer: ReturnType<typeof setInterval> | null = null;
  #ripiego: ReturnType<typeof setInterval> | null = null;
  #attesa: ReturnType<typeof setTimeout> | null = null;

  constructor(iniziale: DettaglioPartita) {
    this.dettaglio = iniziale;
    this.#partitaId = iniziale.partita.id;
  }

  avvia(): void {
    const socket: Socket<EventiDalServer, EventiDalClient> = io({
      path: '/socket.io',
      // Prima il WebSocket; se un proxy lo blocca, Socket.IO ripiega sul long-polling.
      transports: ['websocket', 'polling'],
    });
    this.#socket = socket;

    socket.on('connect', () => this.#entra());
    socket.on('disconnect', (motivo) => {
      if (this.chiusura) return;
      // "io server disconnect": il server ha chiuso (sessione terminata o account disattivato).
      this.stato = motivo === 'io server disconnect' ? 'scollegato' : 'riconnessione';
      if (motivo === 'io server disconnect')
        this.errore = 'Collegamento chiuso dal server: accedi di nuovo';
      this.#avviaRipiego();
    });
    socket.on('connect_error', (e) => {
      this.stato = socket.active ? 'riconnessione' : 'scollegato';
      this.errore = e.message;
      this.#avviaRipiego();
    });
    socket.io.on('reconnect_attempt', () => {
      if (this.stato !== 'scollegato') this.stato = 'riconnessione';
    });

    socket.on('partita:evento', (evento) => {
      if (evento.versione <= this.dettaglio.versione) return;
      // Per ora ogni evento chiede di riallinearsi; dallo step 6 alcuni porteranno i dati.
      void this.#riallinea();
    });
    socket.on('partita:presenti', (presenti) => {
      this.presenti = presenti;
    });
    socket.on('partita:espulso', (motivo) => this.#chiudi(motivo));
    socket.on('partita:eliminata', () => this.#chiudi('Il Master ha eliminato la partita'));

    this.#timer = setInterval(() => void this.#controllaVersione(), CONTROLLO_MS);
    // Un proxy può bloccare il canale senza far scattare errori: non si aspetta all'infinito.
    this.#attesa = setTimeout(() => {
      if (this.stato === 'collegamento') {
        this.stato = 'riconnessione';
        this.#avviaRipiego();
      }
    }, ATTESA_MAX_MS);
  }

  ferma(): void {
    if (this.#timer) clearInterval(this.#timer);
    if (this.#attesa) clearTimeout(this.#attesa);
    this.#fermaRipiego();
    this.#socket?.emit('partita:esci');
    this.#socket?.disconnect();
    this.#socket = null;
  }

  /** Pulsante "Aggiorna ora" (RF-92). */
  async aggiornaOra(): Promise<void> {
    if (this.#socket?.connected) await this.#riallinea();
    else await this.#daApi();
  }

  #entra(): void {
    this.#socket?.emit('partita:entra', this.#partitaId, (r) => {
      if (!r.ok) {
        this.#chiudi(r.errore);
        return;
      }
      this.#applica(r.istantanea);
      this.presenti = r.presenti;
      this.stato = 'collegato';
      this.errore = null;
      this.#fermaRipiego();
    });
  }

  #riallinea(): Promise<void> {
    return new Promise((fatto) => {
      if (!this.#socket?.connected) return fatto();
      this.#socket.emit('partita:istantanea', (r) => {
        if (r.ok) this.#applica(r.istantanea);
        else this.errore = r.errore;
        fatto();
      });
    });
  }

  async #controllaVersione(): Promise<void> {
    if (!this.#socket?.connected) return;
    this.#socket.emit('partita:versione', (r) => {
      if (r.ok && r.versione !== this.dettaglio.versione) void this.#riallinea();
      else if (r.ok) this.ultimoAggiornamento = Date.now();
    });
  }

  /** Ripiego senza tempo reale: lo stesso stato dall'API REST. */
  async #daApi(): Promise<void> {
    try {
      const dettaglio = await api(`/api/partite/${this.#partitaId}`, { schema: DettaglioPartita });
      this.#applica({ versione: dettaglio.versione, dettaglio });
    } catch (e) {
      if (e instanceof ErroreApi && e.stato === 404)
        this.#chiudi('Non partecipi più a questa partita');
      else this.errore = e instanceof ErroreApi ? e.message : 'Aggiornamento non riuscito';
    }
  }

  #applica(istantanea: Istantanea): void {
    this.dettaglio = istantanea.dettaglio;
    this.ultimoAggiornamento = Date.now();
  }

  #avviaRipiego(): void {
    if (this.#ripiego || this.chiusura) return;
    this.#ripiego = setInterval(() => void this.#daApi(), RIPIEGO_MS);
  }

  #fermaRipiego(): void {
    if (this.#ripiego) clearInterval(this.#ripiego);
    this.#ripiego = null;
  }

  #chiudi(motivo: string): void {
    this.chiusura = motivo;
    this.stato = 'scollegato';
    this.ferma();
  }
}
