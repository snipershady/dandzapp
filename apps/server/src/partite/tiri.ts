import { randomInt } from 'node:crypto';
import {
  TIRI_NELLO_STORICO,
  type ComandoTira,
  type RuoloInPartita,
  type Tiro,
} from '@dandzapp/shared';
import type { z } from 'zod';
import type { Db } from '../db/database.ts';
import { ErroreHttp } from '../http/errori.ts';

/**
 * Dadi e storico (RF-50…RF-63). I dadi si tirano qui, sul server: il client sceglie
 * solo cosa tirare, mai i risultati né il personaggio (RF-52, RF-63).
 */

/** `randomInt` usa una sorgente crittografica e scarta i valori che distorcerebbero (RF-52). */
export const tiraDado = (facce: number): number => randomInt(1, facce + 1);

function queryTiri(db: Db, partitaId: number) {
  return db
    .selectFrom('tiri')
    .innerJoin('utenti', 'utenti.id', 'tiri.utente_id')
    .selectAll('tiri')
    .select('utenti.nome as utente_nome')
    .where('tiri.partita_id', '=', partitaId);
}

type RigaTiro = Awaited<ReturnType<ReturnType<typeof queryTiri>['execute']>>[number];

const aTiro = (r: RigaTiro): Tiro => ({
  id: r.id,
  utenteId: r.utente_id,
  utente: r.utente_nome,
  personaggio: r.personaggio_nome,
  motivo: r.motivo,
  numero: r.n_dadi,
  facce: r.facce,
  modificatore: r.modificatore,
  risultati: r.risultati,
  totale: r.totale,
  nascosto: Boolean(r.nascosto),
  creatoIl: r.creato_il.toISOString(),
});

/** Gli ultimi tiri, dal più recente. I tiri nascosti li vede solo il Master (RF-61). */
export async function elencaTiri(
  db: Db,
  partitaId: number,
  ruolo: RuoloInPartita,
): Promise<Tiro[]> {
  let query = queryTiri(db, partitaId);
  if (ruolo !== 'master') query = query.where('tiri.nascosto', '=', 0);
  const righe = await query
    .orderBy('tiri.creato_il', 'desc')
    .orderBy('tiri.id', 'desc')
    .limit(TIRI_NELLO_STORICO)
    .execute();
  return righe.map(aTiro);
}

/**
 * Tira i dadi per un utente della partita. Il Master tira come "Master" e può tirare di
 * nascosto (RF-54); un giocatore tira come il PG scelto in "Giochi come" e deve averne
 * scelto uno.
 */
export async function tira(
  db: Db,
  partitaId: number,
  utenteId: number,
  ruolo: RuoloInPartita,
  c: z.output<typeof ComandoTira>,
  ora: Date,
): Promise<Tiro> {
  if (ruolo === 'osservatore') throw new ErroreHttp(403, 'Partecipi in sola lettura');
  if (c.nascosto && ruolo !== 'master') {
    throw new ErroreHttp(403, 'Solo il Master può tirare di nascosto');
  }

  let personaggio: { id: number | null; nome: string } = { id: null, nome: 'Master' };
  if (ruolo === 'giocatore') {
    const scelta = await db
      .selectFrom('partecipazioni')
      .innerJoin('personaggi', 'personaggi.id', 'partecipazioni.personaggio_id')
      .select(['personaggi.id', 'personaggi.nome'])
      .where('partecipazioni.partita_id', '=', partitaId)
      .where('partecipazioni.utente_id', '=', utenteId)
      .executeTakeFirst();
    if (!scelta) {
      throw new ErroreHttp(409, 'Scegli prima il tuo personaggio in "Giochi come"');
    }
    personaggio = scelta;
  }

  const risultati = Array.from({ length: c.numero }, () => tiraDado(c.facce));
  const totale = risultati.reduce((a, b) => a + b, 0) + c.modificatore;
  const { insertId } = await db
    .insertInto('tiri')
    .values({
      partita_id: partitaId,
      utente_id: utenteId,
      personaggio_id: personaggio.id,
      personaggio_nome: personaggio.nome,
      motivo: c.motivo,
      n_dadi: c.numero,
      facce: c.facce,
      modificatore: c.modificatore,
      risultati: JSON.stringify(risultati),
      totale,
      nascosto: c.nascosto,
      creato_il: ora,
    })
    .executeTakeFirstOrThrow();
  const riga = await queryTiri(db, partitaId)
    .where('tiri.id', '=', Number(insertId))
    .executeTakeFirstOrThrow();
  return aTiro(riga);
}

/** Svuota lo storico dei tiri della partita (RF-62). */
export async function svuotaTiri(db: Db, partitaId: number): Promise<void> {
  await db.deleteFrom('tiri').where('partita_id', '=', partitaId).execute();
}
