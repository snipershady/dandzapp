import type { RuoloInPartita } from '@dandzapp/shared';
import type { Db } from '../db/database.ts';
import type { RigaPartita } from '../db/schema.ts';
import { ErroreHttp } from '../http/errori.ts';

export type Accesso = { partita: RigaPartita; ruolo: RuoloInPartita };

const NON_TROVATA = 'Partita non trovata';

/**
 * Ruolo dell'utente nella partita. Chi non è né Master né partecipante riceve 404,
 * come se la partita non esistesse (§4.1, RF-06).
 */
export async function accessoPartita(
  db: Db,
  partitaId: number,
  utenteId: number,
): Promise<Accesso> {
  const riga = await db
    .selectFrom('partite')
    .leftJoin('partecipazioni', (j) =>
      j
        .onRef('partecipazioni.partita_id', '=', 'partite.id')
        .on('partecipazioni.utente_id', '=', utenteId),
    )
    .selectAll('partite')
    .select('partecipazioni.ruolo as ruolo_partecipante')
    .where('partite.id', '=', partitaId)
    .executeTakeFirst();
  if (!riga) throw new ErroreHttp(404, NON_TROVATA);

  const { ruolo_partecipante, ...partita } = riga;
  if (partita.master_id === utenteId) return { partita, ruolo: 'master' };
  if (ruolo_partecipante) return { partita, ruolo: ruolo_partecipante };
  throw new ErroreHttp(404, NON_TROVATA);
}

/** Partita di cui l'utente è il Master: 404 se non vi partecipa, 403 se è solo partecipante. */
export async function richiediMasterPartita(
  db: Db,
  partitaId: number,
  utenteId: number,
): Promise<RigaPartita> {
  const { partita, ruolo } = await accessoPartita(db, partitaId, utenteId);
  if (ruolo !== 'master') throw new ErroreHttp(403, 'Solo il Master della partita può farlo');
  return partita;
}
