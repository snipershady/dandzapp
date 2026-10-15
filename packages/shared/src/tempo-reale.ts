import { z } from 'zod';
import { DettaglioPartita, RuoloInPartita } from './partite.ts';

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

/** Tipi di evento: per ora solo "qualcosa è cambiato, riallineati". Gli step 6–10 ne aggiungono. */
export type EventoPartita = { versione: number; tipo: 'modificata' };

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
}
