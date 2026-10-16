import type { Narrazione } from '@dandzapp/shared';
import type { Db } from '../db/database.ts';
import { ErroreHttp } from '../http/errori.ts';

/**
 * Narrazione "Il Master legge" (RF-70). Ogni testo pubblicato resta nello storico della
 * partita; `partite.narrazione_id` indica quello mostrato ora (o nessuno).
 */

/** Quanti testi già pubblicati mostra lo storico del Master. */
const NELLO_STORICO = 50;

const aNarrazione = (r: { id: number; testo: string; pubblicata_il: Date }): Narrazione => ({
  id: r.id,
  testo: r.testo,
  pubblicataIl: r.pubblicata_il.toISOString(),
});

/** Il testo mostrato ora al tavolo, o `null`. */
export async function narrazioneCorrente(db: Db, partitaId: number): Promise<Narrazione | null> {
  const riga = await db
    .selectFrom('partite')
    .innerJoin('narrazioni', 'narrazioni.id', 'partite.narrazione_id')
    .select(['narrazioni.id', 'narrazioni.testo', 'narrazioni.pubblicata_il'])
    .where('partite.id', '=', partitaId)
    .executeTakeFirst();
  return riga ? aNarrazione(riga) : null;
}

/** I testi già pubblicati, dal più recente: solo per il Master. */
export async function storicoNarrazioni(db: Db, partitaId: number): Promise<Narrazione[]> {
  const righe = await db
    .selectFrom('narrazioni')
    .select(['id', 'testo', 'pubblicata_il'])
    .where('partita_id', '=', partitaId)
    .orderBy('pubblicata_il', 'desc')
    .orderBy('id', 'desc')
    .limit(NELLO_STORICO)
    .execute();
  return righe.map(aNarrazione);
}

async function mostra(db: Db, partitaId: number, narrazioneId: number | null) {
  await db
    .updateTable('partite')
    .set({ narrazione_id: narrazioneId })
    .where('id', '=', partitaId)
    .execute();
}

/** Pubblica un testo nuovo: diventa quello mostrato a tutti. */
export async function pubblicaNarrazione(
  db: Db,
  partitaId: number,
  testo: string,
  ora: Date,
): Promise<Narrazione | null> {
  const { insertId } = await db
    .insertInto('narrazioni')
    .values({ partita_id: partitaId, testo, creata_il: ora, pubblicata_il: ora })
    .executeTakeFirstOrThrow();
  await mostra(db, partitaId, Number(insertId));
  return narrazioneCorrente(db, partitaId);
}

async function trova(db: Db, partitaId: number, narrazioneId: number): Promise<void> {
  const riga = await db
    .selectFrom('narrazioni')
    .select('id')
    .where('id', '=', narrazioneId)
    .where('partita_id', '=', partitaId)
    .executeTakeFirst();
  if (!riga) throw new ErroreHttp(404, 'Testo non trovato');
}

/** Ripubblica un testo dello storico. */
export async function ripubblicaNarrazione(
  db: Db,
  partitaId: number,
  narrazioneId: number,
  ora: Date,
): Promise<Narrazione | null> {
  await trova(db, partitaId, narrazioneId);
  await db
    .updateTable('narrazioni')
    .set({ pubblicata_il: ora })
    .where('id', '=', narrazioneId)
    .execute();
  await mostra(db, partitaId, narrazioneId);
  return narrazioneCorrente(db, partitaId);
}

/** Nasconde il testo mostrato: resta nello storico. */
export async function nascondiNarrazione(db: Db, partitaId: number): Promise<Narrazione | null> {
  await mostra(db, partitaId, null);
  return null;
}

/** Toglie un testo dallo storico; se era mostrato, sparisce anche dal tavolo. */
export async function eliminaNarrazione(
  db: Db,
  partitaId: number,
  narrazioneId: number,
): Promise<Narrazione | null> {
  await trova(db, partitaId, narrazioneId);
  await db.deleteFrom('narrazioni').where('id', '=', narrazioneId).execute();
  return narrazioneCorrente(db, partitaId);
}
