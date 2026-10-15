import type { Db } from '../db/database.ts';
import type { RigaUtente } from '../db/schema.ts';
import { hashToken, nuovoToken } from './token.ts';

export const DURATA_SESSIONE_MS = 30 * 24 * 60 * 60 * 1000;

/** Apre una sessione e restituisce il token da mettere nel cookie. */
export async function creaSessione(db: Db, utenteId: number, ora: Date): Promise<string> {
  const token = nuovoToken();
  // Pulizia delle sessioni scadute dello stesso utente.
  await db
    .deleteFrom('sessioni')
    .where('utente_id', '=', utenteId)
    .where('scade_il', '<=', ora)
    .execute();
  await db
    .insertInto('sessioni')
    .values({
      token_hash: hashToken(token),
      utente_id: utenteId,
      scade_il: new Date(ora.getTime() + DURATA_SESSIONE_MS),
    })
    .execute();
  return token;
}

/** Utente della sessione, se il token è valido, non scaduto e l'utente è attivo. */
export async function utenteDaSessione(
  db: Db,
  token: string,
  ora: Date,
): Promise<RigaUtente | null> {
  const riga = await db
    .selectFrom('sessioni')
    .innerJoin('utenti', 'utenti.id', 'sessioni.utente_id')
    .selectAll('utenti')
    .where('sessioni.token_hash', '=', hashToken(token))
    .where('sessioni.scade_il', '>', ora)
    .where('utenti.attivo', '=', 1)
    .executeTakeFirst();
  return riga ?? null;
}

export async function chiudiSessione(db: Db, token: string): Promise<void> {
  await db.deleteFrom('sessioni').where('token_hash', '=', hashToken(token)).execute();
}

/** Chiude tutte le sessioni dell'utente (cambio password, disattivazione). */
export async function chiudiSessioniUtente(db: Db, utenteId: number): Promise<void> {
  await db.deleteFrom('sessioni').where('utente_id', '=', utenteId).execute();
}
