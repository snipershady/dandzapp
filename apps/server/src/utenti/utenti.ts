import type { Ruolo, Utente } from '@dandzapp/shared';
import type { Db } from '../db/database.ts';
import type { RigaUtente } from '../db/schema.ts';

/** Dati di un utente che possono essere inviati al browser. */
export function aUtentePubblico(riga: RigaUtente): Utente {
  return {
    id: riga.id,
    email: riga.email,
    nome: riga.nome,
    avatarUrl: riga.avatar_url,
    ruolo: riga.ruolo,
  };
}

export function trovaUtentePerEmail(db: Db, email: string): Promise<RigaUtente | undefined> {
  return db.selectFrom('utenti').selectAll().where('email', '=', email).executeTakeFirst();
}

export function trovaUtentePerId(db: Db, id: number): Promise<RigaUtente | undefined> {
  return db.selectFrom('utenti').selectAll().where('id', '=', id).executeTakeFirst();
}

/** Crea un utente; restituisce `null` se l'email è già registrata. */
export async function creaUtente(
  db: Db,
  dati: { email: string; nome: string; passwordHash: string | null; ruolo: Ruolo },
): Promise<RigaUtente | null> {
  try {
    const { insertId } = await db
      .insertInto('utenti')
      .values({
        email: dati.email,
        nome: dati.nome,
        password_hash: dati.passwordHash,
        ruolo: dati.ruolo,
      })
      .executeTakeFirstOrThrow();
    return (await trovaUtentePerId(db, Number(insertId))) ?? null;
  } catch (errore) {
    if (eDuplicato(errore)) return null;
    throw errore;
  }
}

export async function impostaPassword(db: Db, id: number, passwordHash: string): Promise<void> {
  await db
    .updateTable('utenti')
    .set({ password_hash: passwordHash })
    .where('id', '=', id)
    .execute();
}

function eDuplicato(errore: unknown): boolean {
  return (
    typeof errore === 'object' &&
    errore !== null &&
    'code' in errore &&
    errore.code === 'ER_DUP_ENTRY'
  );
}
