import { CorpoModificaPersonaggio, CorpoPersonaggio, type Personaggio } from '@dandzapp/shared';
import type { z } from 'zod';
import type { Db } from '../db/database.ts';
import type { RigaPersonaggio } from '../db/schema.ts';
import { ErroreHttp } from '../http/errori.ts';

function aPersonaggio(r: RigaPersonaggio): Personaggio {
  return {
    id: r.id,
    nome: r.nome,
    classe: r.classe,
    sigla: r.sigla,
    colore: r.colore,
    utenteId: r.utente_id,
  };
}

export async function elencaPersonaggi(db: Db, partitaId: number): Promise<Personaggio[]> {
  const righe = await db
    .selectFrom('personaggi')
    .selectAll()
    .where('partita_id', '=', partitaId)
    .orderBy('posto')
    .orderBy('id')
    .execute();
  return righe.map(aPersonaggio);
}

/** Il giocatore indicato deve partecipare alla partita con ruolo "giocatore". */
async function verificaGiocatore(db: Db, partitaId: number, utenteId: number | null) {
  if (utenteId === null) return;
  const p = await db
    .selectFrom('partecipazioni')
    .select('ruolo')
    .where('partita_id', '=', partitaId)
    .where('utente_id', '=', utenteId)
    .executeTakeFirst();
  if (p?.ruolo !== 'giocatore') {
    throw new ErroreHttp(400, 'Controlla i dati inseriti', {
      utenteId: 'Può controllare un PG solo chi partecipa come giocatore',
    });
  }
}

/** Traduce le violazioni dei vincoli di unicità in errori sul campo giusto. */
function erroreDuplicato(errore: unknown): never {
  if (typeof errore === 'object' && errore !== null && 'code' in errore) {
    const messaggio = 'sqlMessage' in errore ? String(errore.sqlMessage) : '';
    if (errore.code === 'ER_DUP_ENTRY' && messaggio.includes('personaggi_partita_nome')) {
      throw new ErroreHttp(409, 'Controlla i dati inseriti', {
        nome: 'Esiste già un PG con questo nome',
      });
    }
    if (errore.code === 'ER_DUP_ENTRY' && messaggio.includes('personaggi_partita_sigla')) {
      throw new ErroreHttp(409, 'Controlla i dati inseriti', {
        sigla: 'Sigla già usata da un altro PG',
      });
    }
  }
  throw errore;
}

/**
 * Crea un PG nel primo posto di partenza libero dell'avventura (RF-34). Se i posti
 * finiscono, i PG successivi ricominciano dal primo.
 */
export async function creaPersonaggio(
  db: Db,
  partitaId: number,
  dati: z.output<typeof CorpoPersonaggio>,
): Promise<Personaggio> {
  await verificaGiocatore(db, partitaId, dati.utenteId);
  const { definizione } = await db
    .selectFrom('partite')
    .innerJoin('avventure', 'avventure.id', 'partite.avventura_id')
    .select('avventure.definizione')
    .where('partite.id', '=', partitaId)
    .executeTakeFirstOrThrow();
  const occupati = new Set(
    (
      await db
        .selectFrom('personaggi')
        .select('posto')
        .where('partita_id', '=', partitaId)
        .execute()
    ).map((r) => r.posto),
  );
  const partenze = definizione.partenze;
  let posto = partenze.findIndex((_, i) => !occupati.has(i));
  if (posto === -1) posto = occupati.size % partenze.length;
  const [x, y] = partenze[posto] ?? [0, 0];

  try {
    const { insertId } = await db
      .insertInto('personaggi')
      .values({
        partita_id: partitaId,
        nome: dati.nome,
        classe: dati.classe,
        sigla: dati.sigla,
        colore: dati.colore,
        utente_id: dati.utenteId,
        posto,
        x,
        y,
      })
      .executeTakeFirstOrThrow();
    const riga = await db
      .selectFrom('personaggi')
      .selectAll()
      .where('id', '=', Number(insertId))
      .executeTakeFirstOrThrow();
    if (dati.utenteId !== null)
      await preselezionaPersonaggio(db, partitaId, dati.utenteId, riga.id);
    return aPersonaggio(riga);
  } catch (e) {
    erroreDuplicato(e);
  }
}

export async function modificaPersonaggio(
  db: Db,
  partitaId: number,
  personaggioId: number,
  modifiche: z.output<typeof CorpoModificaPersonaggio>,
): Promise<Personaggio> {
  await trovaPersonaggio(db, partitaId, personaggioId);
  if (modifiche.utenteId !== undefined) await verificaGiocatore(db, partitaId, modifiche.utenteId);
  const { utenteId, ...resto } = modifiche;
  try {
    await db
      .updateTable('personaggi')
      .set({ ...resto, ...(utenteId !== undefined ? { utente_id: utenteId } : {}) })
      .where('id', '=', personaggioId)
      .execute();
  } catch (e) {
    erroreDuplicato(e);
  }
  if (utenteId) await preselezionaPersonaggio(db, partitaId, utenteId, personaggioId);
  return aPersonaggio(await trovaPersonaggio(db, partitaId, personaggioId));
}

export async function eliminaPersonaggio(
  db: Db,
  partitaId: number,
  personaggioId: number,
): Promise<void> {
  await trovaPersonaggio(db, partitaId, personaggioId);
  await db.deleteFrom('personaggi').where('id', '=', personaggioId).execute();
}

async function trovaPersonaggio(
  db: Db,
  partitaId: number,
  personaggioId: number,
): Promise<RigaPersonaggio> {
  const riga = await db
    .selectFrom('personaggi')
    .selectAll()
    .where('id', '=', personaggioId)
    .where('partita_id', '=', partitaId)
    .executeTakeFirst();
  if (!riga) throw new ErroreHttp(404, 'Personaggio non trovato');
  return riga;
}

/** Il PG assegnato diventa il "Giochi come" del giocatore, se non ne aveva scelto uno (RF-03). */
export async function preselezionaPersonaggio(
  db: Db,
  partitaId: number,
  utenteId: number,
  personaggioId: number,
): Promise<void> {
  await db
    .updateTable('partecipazioni')
    .set({ personaggio_id: personaggioId })
    .where('partita_id', '=', partitaId)
    .where('utente_id', '=', utenteId)
    .where('personaggio_id', 'is', null)
    .execute();
}
