import { z } from 'zod';

export const RUOLI = ['ROLE_MASTER', 'ROLE_PLAYER'] as const;
export const Ruolo = z.enum(RUOLI);
export type Ruolo = z.infer<typeof Ruolo>;

export const PASSWORD_MIN = 10;

const email = z
  .string({ error: "Inserisci l'email" })
  .trim()
  .toLowerCase()
  .max(254, 'Email troppo lunga')
  .pipe(z.email({ error: 'Email non valida' }));

const password = z
  .string({ error: 'Inserisci la password' })
  .min(PASSWORD_MIN, `La password deve avere almeno ${PASSWORD_MIN} caratteri`)
  .max(200, 'Password troppo lunga');

const nome = z
  .string({ error: 'Inserisci il nome' })
  .trim()
  .min(2, 'Il nome deve avere almeno 2 caratteri')
  .max(60, 'Il nome può avere al massimo 60 caratteri');

/** Il ruolo non si sceglie: chi si registra è sempre ROLE_PLAYER (RF-01b). */
export const CorpoRegistrazione = z.object({ email, password, nome });
export type CorpoRegistrazione = z.infer<typeof CorpoRegistrazione>;

export const CorpoAccesso = z.object({
  email,
  password: z.string({ error: 'Inserisci la password' }).min(1, 'Inserisci la password').max(200),
});
export type CorpoAccesso = z.infer<typeof CorpoAccesso>;

export const CorpoPasswordDimenticata = z.object({ email });
export type CorpoPasswordDimenticata = z.infer<typeof CorpoPasswordDimenticata>;

export const CorpoReimpostaPassword = z.object({
  token: z.string().min(1, 'Link non valido').max(200),
  password,
});
export type CorpoReimpostaPassword = z.infer<typeof CorpoReimpostaPassword>;

/** Dati dell'utente che possono arrivare al browser (mai l'hash della password). */
export const Utente = z.object({
  id: z.number().int(),
  email: z.string(),
  nome: z.string(),
  avatarUrl: z.string().nullable(),
  ruolo: Ruolo,
});
export type Utente = z.infer<typeof Utente>;

export const RispostaUtente = z.object({ utente: Utente });
export type RispostaUtente = z.infer<typeof RispostaUtente>;

/** Formato di ogni risposta di errore dell'API. */
export const RispostaErrore = z.object({
  errore: z.string(),
  campi: z.record(z.string(), z.string()).optional(),
});
export type RispostaErrore = z.infer<typeof RispostaErrore>;
