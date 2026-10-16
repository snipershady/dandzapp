import { z } from 'zod';
import {
  DettaglioPartita,
  MAX_NARRAZIONE,
  RuoloInPartita,
  type Narrazione,
  type Tiro,
} from './partite.ts';

/**
 * Protocollo Socket.IO del tavolo (§15.3). Il server è l'unica autorità: il client
 * entra in una partita, riceve un'istantanea filtrata per il suo ruolo e poi gli
 * eventi numerati con la `versione` della partita. Se nota un salto di versione,
 * chiede una nuova istantanea.
 */

/** Persona con la pagina della partita aperta in questo momento (RF-80). */
export const PresenteAlTavolo = z.object({
  utenteId: z.number().int(),
  nome: z.string(),
  avatarUrl: z.string().nullable(),
  ruolo: RuoloInPartita,
  personaggioId: z.number().int().nullable(),
});
export type PresenteAlTavolo = z.infer<typeof PresenteAlTavolo>;

export const Istantanea = z.object({
  versione: z.number().int(),
  dettaglio: DettaglioPartita,
});
export type Istantanea = z.infer<typeof Istantanea>;

export type RispostaEntra =
  | { ok: true; istantanea: Istantanea; presenti: PresenteAlTavolo[] }
  | { ok: false; errore: string };

export type RispostaIstantanea =
  { ok: true; istantanea: Istantanea } | { ok: false; errore: string };

export type RispostaVersione = { ok: true; versione: number } | { ok: false; errore: string };

/**
 * Eventi numerati con la versione della partita. `modificata` chiede solo di riallinearsi
 * (il client chiede l'istantanea); gli altri portano i dati, e il client li applica solo
 * se la loro versione è la successiva a quella che ha.
 */
export type EventoPartita =
  | { versione: number; tipo: 'modificata' }
  | { versione: number; tipo: 'pedina:spostata'; personaggioId: number; x: number; y: number }
  /** Solo al Master: la posizione salvata di un mostro (RF-43). */
  | { versione: number; tipo: 'mostro:spostato'; mostroId: number; x: number; y: number }
  /** Un tiro nuovo; quelli nascosti arrivano solo al Master (RF-54). */
  | { versione: number; tipo: 'dado:tirato'; tiro: Tiro }
  /** Il testo "Il Master legge" mostrato ora, o `null` se nascosto (RF-70). */
  | { versione: number; tipo: 'narrazione:cambiata'; narrazione: Narrazione | null };

/** Comando "sposta una pedina PG" (RF-31): coordinate della mappa, controllate dal server. */
export const ComandoSpostaPedina = z
  .object({
    personaggioId: z.number().int().positive(),
    x: z.number().finite().nonnegative(),
    y: z.number().finite().nonnegative(),
  })
  .strict();
export type ComandoSpostaPedina = z.infer<typeof ComandoSpostaPedina>;

/** Comando del Master: scopre o ricopre una zona della nebbia (RF-22). */
export const ComandoZona = z
  .object({ zonaId: z.string().min(1).max(64), scoperta: z.boolean() })
  .strict();
export type ComandoZona = z.infer<typeof ComandoZona>;

/** Numero massimo di mostri sul tavolo di una partita. */
export const MAX_MOSTRI = 100;

/**
 * Comando del Master: aggiunge da 1 a 12 mostri in una zona (RF-40). Il tipo è la sigla
 * di uno dei tipi dell'avventura, oppure "Altro" con un nome libero.
 */
export const ComandoAggiungiMostri = z
  .object({
    tipo: z.string().max(3).optional(),
    altro: z
      .string()
      .trim()
      .min(1, 'Scrivi il nome del mostro')
      .max(60, 'Il nome può avere al massimo 60 caratteri')
      .optional(),
    quantita: z.number().int().min(1).max(12),
    zonaId: z.string().min(1).max(64),
  })
  .strict()
  .refine((c) => (c.tipo === undefined) !== (c.altro === undefined), {
    message: 'Scegli un tipo di mostro oppure scrivi il nome',
  });
export type ComandoAggiungiMostri = z.infer<typeof ComandoAggiungiMostri>;

export const ComandoSpostaMostro = z
  .object({
    mostroId: z.number().int().positive(),
    x: z.number().finite().nonnegative(),
    y: z.number().finite().nonnegative(),
  })
  .strict();
export type ComandoSpostaMostro = z.infer<typeof ComandoSpostaMostro>;

export const ComandoTogliMostro = z.object({ mostroId: z.number().int().positive() }).strict();
export type ComandoTogliMostro = z.infer<typeof ComandoTogliMostro>;

/** Dadi disponibili (RF-50). */
export const FACCE = [4, 6, 8, 10, 12, 20, 100] as const;

/**
 * Comando "tira i dadi" (RF-50, RF-51). Il client sceglie solo cosa tirare: risultati e
 * personaggio li decide il server (RF-52, RF-63).
 */
export const ComandoTira = z
  .object({
    facce: z.union(FACCE.map((f) => z.literal(f))),
    numero: z.number().int().min(1).max(20),
    modificatore: z.number().int().min(-20).max(50),
    motivo: z.string().trim().max(60, 'Il motivo può avere al massimo 60 caratteri').default(''),
    nascosto: z.boolean().default(false),
  })
  .strict();
export type ComandoTira = z.input<typeof ComandoTira>;

export type RispostaTiro = { ok: true; tiro: Tiro } | { ok: false; errore: string };

/** Comando del Master: pubblica un nuovo testo per tutti (RF-70). */
export const ComandoPubblicaNarrazione = z
  .object({
    testo: z
      .string()
      .trim()
      .min(1, 'Scrivi il testo da leggere')
      .max(MAX_NARRAZIONE, `Il testo può avere al massimo ${MAX_NARRAZIONE} caratteri`),
  })
  .strict();
export type ComandoPubblicaNarrazione = z.input<typeof ComandoPubblicaNarrazione>;

/** Comando del Master su un testo già pubblicato: ripubblicarlo o toglierlo dallo storico. */
export const ComandoNarrazione = z.object({ narrazioneId: z.number().int().positive() }).strict();
export type ComandoNarrazione = z.infer<typeof ComandoNarrazione>;

/** Esito di un comando inviato al server. */
export type RispostaComando = { ok: true } | { ok: false; errore: string };

export interface EventiDalServer {
  'partita:evento': (evento: EventoPartita) => void;
  'partita:presenti': (presenti: PresenteAlTavolo[]) => void;
  /** Tolto dalla partita dal Master (o uscito da un'altra scheda). */
  'partita:espulso': (motivo: string) => void;
  'partita:eliminata': () => void;
}

export interface EventiDalClient {
  'partita:entra': (partitaId: number, risposta: (r: RispostaEntra) => void) => void;
  'partita:istantanea': (risposta: (r: RispostaIstantanea) => void) => void;
  'partita:versione': (risposta: (r: RispostaVersione) => void) => void;
  'partita:esci': () => void;
  'pedina:sposta': (comando: ComandoSpostaPedina, risposta: (r: RispostaComando) => void) => void;
  /** Solo Master: riporta tutte le pedine dei PG ai posti di partenza (RF-34). */
  'pedine:riporta': (risposta: (r: RispostaComando) => void) => void;
  /** Solo Master: scopre o ricopre una zona (RF-22). */
  'zona:imposta': (comando: ComandoZona, risposta: (r: RispostaComando) => void) => void;
  /** Solo Master: mostri (RF-40…RF-43). */
  'mostri:aggiungi': (
    comando: ComandoAggiungiMostri,
    risposta: (r: RispostaComando) => void,
  ) => void;
  'mostro:sposta': (comando: ComandoSpostaMostro, risposta: (r: RispostaComando) => void) => void;
  'mostro:togli': (comando: ComandoTogliMostro, risposta: (r: RispostaComando) => void) => void;
  'mostri:togli-tutti': (risposta: (r: RispostaComando) => void) => void;
  /** Tiro di dadi (RF-50…RF-54): Master e giocatori con un PG scelto. */
  'dadi:tira': (comando: ComandoTira, risposta: (r: RispostaTiro) => void) => void;
  /** Solo Master: svuota lo storico dei tiri (RF-62). */
  'tiri:svuota': (risposta: (r: RispostaComando) => void) => void;
  /** Solo Master: narrazione "Il Master legge" (RF-70). */
  'narrazione:pubblica': (
    comando: ComandoPubblicaNarrazione,
    risposta: (r: RispostaComando) => void,
  ) => void;
  'narrazione:ripubblica': (
    comando: ComandoNarrazione,
    risposta: (r: RispostaComando) => void,
  ) => void;
  'narrazione:elimina': (
    comando: ComandoNarrazione,
    risposta: (r: RispostaComando) => void,
  ) => void;
  'narrazione:nascondi': (risposta: (r: RispostaComando) => void) => void;
}
