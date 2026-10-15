import { z } from 'zod';
import { Ruolo } from './auth.ts';

/** Utente come lo vede il pannello di amministrazione (RF-01b, §4.1). */
export const UtenteAmministrato = z.object({
  id: z.number().int(),
  email: z.string(),
  nome: z.string(),
  ruolo: Ruolo,
  attivo: z.boolean(),
  /** `false` per un Master creato da riga di comando che non ha ancora scelto la password. */
  haPassword: z.boolean(),
  creatoIl: z.string(),
});
export type UtenteAmministrato = z.infer<typeof UtenteAmministrato>;

export const MAX_UTENTI_ELENCO = 100;

export const RispostaElencoUtenti = z.object({
  utenti: z.array(UtenteAmministrato),
  /** Numero totale di utenti che corrispondono alla ricerca (l'elenco ne mostra al massimo 100). */
  totale: z.number().int(),
});
export type RispostaElencoUtenti = z.infer<typeof RispostaElencoUtenti>;

export const CorpoModificaUtente = z
  .object({ ruolo: Ruolo.optional(), attivo: z.boolean().optional() })
  .strict()
  .refine((m) => m.ruolo !== undefined || m.attivo !== undefined, 'Nessuna modifica indicata');
export type CorpoModificaUtente = z.infer<typeof CorpoModificaUtente>;

export const RispostaUtenteAmministrato = z.object({ utente: UtenteAmministrato });
export type RispostaUtenteAmministrato = z.infer<typeof RispostaUtenteAmministrato>;
