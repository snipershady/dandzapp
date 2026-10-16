import type {
  CorpoModificaPartita,
  DettaglioPartita,
  RiepilogoPartita,
  RispostaElencoPartite,
  RuoloInPartita,
} from '@dandzapp/shared';
import type { Db } from '../db/database.ts';
import { ErroreHttp } from '../http/errori.ts';
import { elencaInviti } from './inviti.ts';
import { infoMappa } from './mappa.ts';
import { elencaMostri, tipiMostro } from './mostri.ts';
import { zoneDelMaster } from './nebbia.ts';
import { elencaPartecipanti } from './partecipanti.ts';
import { elencaPersonaggi } from './personaggi.ts';

/** Partite con i dati per il riepilogo: avventura, Master e numero di partecipanti. */
function queryRiepiloghi(db: Db) {
  return db
    .selectFrom('partite')
    .innerJoin('utenti as master', 'master.id', 'partite.master_id')
    .innerJoin('avventure', 'avventure.id', 'partite.avventura_id')
    .select((eb) => [
      'partite.id',
      'partite.titolo',
      'partite.stato',
      'partite.versione',
      'partite.master_id',
      'master.nome as master_nome',
      'avventure.titolo as avventura_titolo',
      'avventure.sottotitolo as avventura_sottotitolo',
      eb
        .selectFrom('partecipazioni')
        .select((e) => e.fn.countAll<number>().as('n'))
        .whereRef('partecipazioni.partita_id', '=', 'partite.id')
        .as('numero_partecipanti'),
    ])
    .orderBy('partite.stato')
    .orderBy('partite.aggiornata_il', 'desc');
}

type RigaRiepilogo = Awaited<ReturnType<ReturnType<typeof queryRiepiloghi>['execute']>>[number];

function aRiepilogo(r: RigaRiepilogo, mioRuolo: RuoloInPartita): RiepilogoPartita {
  return {
    id: r.id,
    titolo: r.titolo,
    stato: r.stato,
    avventura: { titolo: r.avventura_titolo, sottotitolo: r.avventura_sottotitolo },
    master: { id: r.master_id, nome: r.master_nome },
    mioRuolo,
    numeroPartecipanti: Number(r.numero_partecipanti ?? 0),
  };
}

/** "Le mie partite" (RF-05): quelle che conduco e quelle a cui partecipo. */
export async function elencaPartite(db: Db, utenteId: number): Promise<RispostaElencoPartite> {
  const [conduco, partecipo] = await Promise.all([
    queryRiepiloghi(db).where('partite.master_id', '=', utenteId).execute(),
    queryRiepiloghi(db)
      .innerJoin('partecipazioni as mia', (j) =>
        j.onRef('mia.partita_id', '=', 'partite.id').on('mia.utente_id', '=', utenteId),
      )
      .select('mia.ruolo as mio_ruolo')
      .execute(),
  ]);
  return {
    conduco: conduco.map((r) => aRiepilogo(r, 'master')),
    partecipo: partecipo.map((r) => aRiepilogo(r, r.mio_ruolo)),
  };
}

export async function creaPartita(
  db: Db,
  { masterId, titolo, avventura }: { masterId: number; titolo: string; avventura: string },
): Promise<number> {
  const riga = await db
    .selectFrom('avventure')
    .select(['id', 'definizione'])
    .where('slug', '=', avventura)
    .executeTakeFirst();
  if (!riga) {
    throw new ErroreHttp(400, 'Controlla i dati inseriti', { avventura: 'Avventura inesistente' });
  }
  return db.transaction().execute(async (trx) => {
    const { insertId } = await trx
      .insertInto('partite')
      .values({ titolo, master_id: masterId, avventura_id: riga.id })
      .executeTakeFirstOrThrow();
    const partitaId = Number(insertId);
    // All'avvio è scoperta solo la zona d'ingresso (RF-23).
    await trx
      .insertInto('zone_scoperte')
      .values(riga.definizione.zoneIniziali.map((zona_id) => ({ partita_id: partitaId, zona_id })))
      .execute();
    return partitaId;
  });
}

export async function dettaglioPartita(
  db: Db,
  partitaId: number,
  ruolo: RuoloInPartita,
): Promise<DettaglioPartita> {
  const riepilogo = await queryRiepiloghi(db)
    .where('partite.id', '=', partitaId)
    .executeTakeFirstOrThrow();
  const master = ruolo === 'master';
  const [mappa, personaggi, partecipanti, inviti, zone, mostri, tipi] = await Promise.all([
    infoMappa(db, partitaId, ruolo),
    elencaPersonaggi(db, partitaId),
    elencaPartecipanti(db, partitaId),
    master ? elencaInviti(db, partitaId, new Date()) : undefined,
    // Le zone (e i loro poligoni) sono uno spoiler: solo per il Master (§15.3).
    master ? zoneDelMaster(db, partitaId) : undefined,
    // Ai giocatori solo i mostri nelle zone scoperte (RF-44).
    elencaMostri(db, partitaId, ruolo),
    master ? tipiMostro(db, partitaId) : undefined,
  ]);
  return {
    partita: aRiepilogo(riepilogo, ruolo),
    versione: Number(riepilogo.versione),
    mappa,
    personaggi,
    partecipanti,
    ...(inviti ? { inviti } : {}),
    ...(zone ? { zone } : {}),
    mostri,
    ...(tipi ? { tipiMostro: tipi } : {}),
  };
}

export async function modificaPartita(
  db: Db,
  partitaId: number,
  modifiche: CorpoModificaPartita,
): Promise<void> {
  await db
    .updateTable('partite')
    .set({ ...modifiche, aggiornata_il: new Date() })
    .where('id', '=', partitaId)
    .execute();
}

/** Elimina la partita con PG, partecipazioni e inviti (cancellazione a cascata). */
export async function eliminaPartita(db: Db, partitaId: number): Promise<void> {
  await db.deleteFrom('partite').where('id', '=', partitaId).execute();
}
