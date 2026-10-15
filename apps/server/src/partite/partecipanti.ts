import type { Partecipante, RuoloPartecipante } from '@dandzapp/shared';
import type { Db } from '../db/database.ts';
import { ErroreHttp } from '../http/errori.ts';

export async function elencaPartecipanti(db: Db, partitaId: number): Promise<Partecipante[]> {
  const righe = await db
    .selectFrom('partecipazioni')
    .innerJoin('utenti', 'utenti.id', 'partecipazioni.utente_id')
    .select(['utenti.id', 'utenti.nome', 'partecipazioni.ruolo'])
    .where('partecipazioni.partita_id', '=', partitaId)
    .orderBy('utenti.nome')
    .execute();
  return righe.map((r) => ({ utenteId: r.id, nome: r.nome, ruolo: r.ruolo }));
}

/** Un osservatore non controlla PG: passando a osservatore li perde (§4.2). */
export async function cambiaRuoloPartecipante(
  db: Db,
  partitaId: number,
  utenteId: number,
  ruolo: RuoloPartecipante,
): Promise<void> {
  await db.transaction().execute(async (trx) => {
    const { numUpdatedRows } = await trx
      .updateTable('partecipazioni')
      .set({ ruolo, ...(ruolo === 'osservatore' ? { personaggio_id: null } : {}) })
      .where('partita_id', '=', partitaId)
      .where('utente_id', '=', utenteId)
      .executeTakeFirst();
    // MySQL conta solo le righe cambiate: si verifica a parte che il partecipante esista.
    if (numUpdatedRows === 0n) await trovaPartecipazione(trx, partitaId, utenteId);
    if (ruolo === 'osservatore') await liberaPersonaggi(trx, partitaId, utenteId);
  });
}

/** Toglie un partecipante dalla partita; i suoi PG restano, senza giocatore. */
export async function rimuoviPartecipante(db: Db, partitaId: number, utenteId: number) {
  await db.transaction().execute(async (trx) => {
    await trovaPartecipazione(trx, partitaId, utenteId);
    await liberaPersonaggi(trx, partitaId, utenteId);
    await trx
      .deleteFrom('partecipazioni')
      .where('partita_id', '=', partitaId)
      .where('utente_id', '=', utenteId)
      .execute();
  });
}

async function trovaPartecipazione(db: Db, partitaId: number, utenteId: number) {
  const riga = await db
    .selectFrom('partecipazioni')
    .select('ruolo')
    .where('partita_id', '=', partitaId)
    .where('utente_id', '=', utenteId)
    .executeTakeFirst();
  if (!riga) throw new ErroreHttp(404, 'Partecipante non trovato');
  return riga;
}

async function liberaPersonaggi(db: Db, partitaId: number, utenteId: number) {
  await db
    .updateTable('personaggi')
    .set({ utente_id: null })
    .where('partita_id', '=', partitaId)
    .where('utente_id', '=', utenteId)
    .execute();
}
