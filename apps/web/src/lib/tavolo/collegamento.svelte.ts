import {
  DettaglioPartita,
  type ComandoAggiungiMostri,
  type ComandoSpostaMostro,
  type ComandoSpostaPedina,
  type ComandoZona,
  type EventiDalClient,
  type EventiDalServer,
  type EventoPartita,
  type Istantanea,
  type PresenteAlTavolo,
  type RispostaComando,
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

    socket.on('partita:evento', (evento) => this.#evento(evento));
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

  /** Sposta la pedina di un PG (RF-31); la nuova posizione arriva a tutti con un evento. */
  spostaPedina(comando: ComandoSpostaPedina): Promise<RispostaComando> {
    return this.#comando((s, r) => s.emit('pedina:sposta', comando, r));
  }

  /** Solo Master: riporta le pedine ai posti di partenza (RF-34). */
  riportaPedine(): Promise<RispostaComando> {
    return this.#comando((s, r) => s.emit('pedine:riporta', r));
  }

  /** Solo Master: scopre o ricopre una zona della nebbia (RF-22). */
  impostaZona(comando: ComandoZona): Promise<RispostaComando> {
    return this.#comando((s, r) => s.emit('zona:imposta', comando, r));
  }

  /** Solo Master: mostri (RF-40…RF-43). */
  aggiungiMostri(comando: ComandoAggiungiMostri): Promise<RispostaComando> {
    return this.#comando((s, r) => s.emit('mostri:aggiungi', comando, r));
  }

  spostaMostro(comando: ComandoSpostaMostro): Promise<RispostaComando> {
    return this.#comando((s, r) => s.emit('mostro:sposta', comando, r));
  }

  togliMostro(mostroId: number): Promise<RispostaComando> {
    return this.#comando((s, r) => s.emit('mostro:togli', { mostroId }, r));
  }

  togliTuttiIMostri(): Promise<RispostaComando> {
    return this.#comando((s, r) => s.emit('mostri:togli-tutti', r));
  }

  #comando(
    invia: (
      socket: Socket<EventiDalServer, EventiDalClient>,
      risposta: (r: RispostaComando) => void,
    ) => void,
  ): Promise<RispostaComando> {
    const socket = this.#socket;
    if (!socket?.connected) {
      return Promise.resolve({ ok: false, errore: 'Non collegato al server: riprova tra poco' });
    }
    return new Promise((fatto) => {
      // Senza risposta entro qualche secondo il comando si considera non riuscito.
      const timer = setTimeout(
        () => fatto({ ok: false, errore: 'Il server non risponde: riprova' }),
        ATTESA_MAX_MS * 2,
      );
      invia(socket, (r) => {
        clearTimeout(timer);
        fatto(r);
      });
    });
  }

  /**
   * Un evento con i dati si applica solo se è il successivo atteso; se ne manca qualcuno
   * si chiede l'istantanea. Gli eventi vecchi (già compresi in un'istantanea) si ignorano.
   */
  #evento(evento: EventoPartita): void {
    const attesa = this.dettaglio.versione + 1;
    if (evento.versione < attesa) return;
    if (evento.versione > attesa || evento.tipo === 'modificata') {
      void this.#riallinea();
      return;
    }
    const segnalino =
      evento.tipo === 'pedina:spostata'
        ? this.dettaglio.personaggi.find((p) => p.id === evento.personaggioId)
        : this.dettaglio.mostri.find((m) => m.id === evento.mostroId);
    if (!segnalino) {
      void this.#riallinea();
      return;
    }
    segnalino.x = evento.x;
    segnalino.y = evento.y;
    this.dettaglio.versione = evento.versione;
    this.ultimoAggiornamento = Date.now();
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
