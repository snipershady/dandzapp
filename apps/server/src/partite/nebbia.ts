import type { ComandoZona, ZonaPartita } from '@dandzapp/shared';
import type { Db } from '../db/database.ts';
import { ErroreHttp } from '../http/errori.ts';
import { zoneScoperte } from './mappa.ts';

/**
 * Nebbia di guerra (RF-20…RF-23). Le zone sono quelle dell'avventura; la partita salva
 * solo quali sono scoperte. I poligoni arrivano soltanto al Master: ai giocatori basta la
 * mappa già composta dal server.
 */

async function definizione(db: Db, partitaId: number) {
  const { definizione } = await db
    .selectFrom('partite')
    .innerJoin('avventure', 'avventure.id', 'partite.avventura_id')
    .select('avventure.definizione')
    .where('partite.id', '=', partitaId)
    .executeTakeFirstOrThrow();
  return definizione;
}

/** Tutte le zone dell'avventura con il loro stato, per il pannello del Master. */
export async function zoneDelMaster(db: Db, partitaId: number): Promise<ZonaPartita[]> {
  const [{ zone }, scoperte] = await Promise.all([
    definizione(db, partitaId),
    zoneScoperte(db, partitaId),
  ]);
  return zone.map((z) => ({
    id: z.id,
    nome: z.nome,
    percorso: z.percorso,
    scoperta: scoperte.includes(z.id),
  }));
}

/** Scopre o ricopre una zona (RF-22). Ripetere lo stesso comando non è un errore. */
export async function impostaZona(
  db: Db,
  partitaId: number,
  { zonaId, scoperta }: ComandoZona,
): Promise<void> {
  const { zone } = await definizione(db, partitaId);
  if (!zone.some((z) => z.id === zonaId)) throw new ErroreHttp(404, 'Zona inesistente');
  if (scoperta) {
    await db
      .insertInto('zone_scoperte')
      .ignore()
      .values({ partita_id: partitaId, zona_id: zonaId })
      .execute();
  } else {
    await db
      .deleteFrom('zone_scoperte')
      .where('partita_id', '=', partitaId)
      .where('zona_id', '=', zonaId)
      .execute();
  }
}
