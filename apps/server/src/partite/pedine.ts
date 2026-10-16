import type { ComandoSpostaPedina } from '@dandzapp/shared';
import type { Db } from '../db/database.ts';
import { ErroreHttp } from '../http/errori.ts';

async function definizione(db: Db, partitaId: number) {
  const { definizione } = await db
    .selectFrom('partite')
    .innerJoin('avventure', 'avventure.id', 'partite.avventura_id')
    .select('avventure.definizione')
    .where('partite.id', '=', partitaId)
    .executeTakeFirstOrThrow();
  return definizione;
}

/** Sposta la pedina di un PG della partita (RF-31). Le coordinate devono stare nella mappa. */
export async function spostaPedina(
  db: Db,
  partitaId: number,
  { personaggioId, x, y }: ComandoSpostaPedina,
): Promise<void> {
  const { mappa } = await definizione(db, partitaId);
  if (x > mappa.larghezza || y > mappa.altezza) {
    throw new ErroreHttp(400, 'La pedina deve restare sulla mappa');
  }
  const { numUpdatedRows } = await db
    .updateTable('personaggi')
    .set({ x, y })
    .where('id', '=', personaggioId)
    .where('partita_id', '=', partitaId)
    .executeTakeFirst();
  // MySQL conta solo le righe cambiate: una pedina lasciata dov'era non è un errore.
  if (numUpdatedRows === 0n) {
    const esiste = await db
      .selectFrom('personaggi')
      .select('id')
      .where('id', '=', personaggioId)
      .where('partita_id', '=', partitaId)
      .executeTakeFirst();
    if (!esiste) throw new ErroreHttp(404, 'Personaggio non trovato');
  }
}

/** Riporta tutte le pedine dei PG ai loro posti di partenza (RF-34). */
export async function riportaPedine(db: Db, partitaId: number): Promise<void> {
  const { partenze } = await definizione(db, partitaId);
  const personaggi = await db
    .selectFrom('personaggi')
    .select(['id', 'posto'])
    .where('partita_id', '=', partitaId)
    .execute();
  for (const { id, posto } of personaggi) {
    const [x, y] = partenze[posto % partenze.length] ?? [0, 0];
    await db.updateTable('personaggi').set({ x, y }).where('id', '=', id).execute();
  }
}
