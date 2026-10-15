import type { Db } from '../db/database.ts';
import { hashToken, nuovoToken } from './token.ts';

export const DURATA_RECUPERO_MS = 60 * 60 * 1000;
export const DURATA_PRIMO_ACCESSO_MS = 7 * 24 * 60 * 60 * 1000;

/** Crea un link monouso per impostare la password; restituisce il token. */
export async function creaRecupero(
  db: Db,
  utenteId: number,
  ora: Date,
  durataMs: number = DURATA_RECUPERO_MS,
): Promise<string> {
  const token = nuovoToken();
  await db
    .insertInto('recuperi_password')
    .values({
      token_hash: hashToken(token),
      utente_id: utenteId,
      scade_il: new Date(ora.getTime() + durataMs),
      usato_il: null,
    })
    .execute();
  return token;
}

/**
 * Consuma il token: restituisce l'id dell'utente se il token era valido e non usato.
 * L'aggiornamento condizionato garantisce l'uso singolo anche con richieste simultanee.
 */
export async function consumaRecupero(db: Db, token: string, ora: Date): Promise<number | null> {
  const tokenHash = hashToken(token);
  const { numUpdatedRows } = await db
    .updateTable('recuperi_password')
    .set({ usato_il: ora })
    .where('token_hash', '=', tokenHash)
    .where('usato_il', 'is', null)
    .where('scade_il', '>', ora)
    .executeTakeFirst();
  if (numUpdatedRows !== 1n) return null;

  const riga = await db
    .selectFrom('recuperi_password')
    .select('utente_id')
    .where('token_hash', '=', tokenHash)
    .executeTakeFirst();
  return riga?.utente_id ?? null;
}
