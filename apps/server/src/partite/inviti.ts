import type { InfoInvito, Invito, RuoloPartecipante } from '@dandzapp/shared';
import { hashToken, nuovoToken } from '../auth/token.ts';
import type { Db } from '../db/database.ts';
import type { RigaInvito } from '../db/schema.ts';
import { ErroreHttp } from '../http/errori.ts';
import { preselezionaPersonaggio } from './personaggi.ts';

export const DURATA_INVITO_MS = 7 * 24 * 60 * 60 * 1000;

function aInvito(r: RigaInvito, ora: Date): Invito {
  return {
    id: r.id,
    email: r.email,
    ruolo: r.ruolo,
    personaggioId: r.personaggio_id,
    scadeIl: r.scade_il.toISOString(),
    scaduto: r.scade_il <= ora,
  };
}

/** Inviti non ancora accettati (quelli accettati sono diventati partecipanti). */
export async function elencaInviti(db: Db, partitaId: number, ora: Date): Promise<Invito[]> {
  const righe = await db
    .selectFrom('inviti')
    .selectAll()
    .where('partita_id', '=', partitaId)
    .where('accettato_il', 'is', null)
    .orderBy('creato_il', 'desc')
    .execute();
  return righe.map((r) => aInvito(r, ora));
}

/**
 * Invita un'email nella partita con un ruolo preciso (RF-02). Un nuovo invito alla
 * stessa email sostituisce quello in sospeso. Restituisce anche il token in chiaro,
 * che finisce solo nel link (nel database c'è l'hash).
 */
export async function creaInvito(
  db: Db,
  {
    partitaId,
    masterId,
    email,
    ruolo,
    personaggioId,
    ora,
  }: {
    partitaId: number;
    masterId: number;
    email: string;
    ruolo: RuoloPartecipante;
    personaggioId: number | null;
    ora: Date;
  },
): Promise<{ invito: Invito; token: string }> {
  const invitato = await db
    .selectFrom('utenti')
    .leftJoin('partecipazioni', (j) =>
      j
        .onRef('partecipazioni.utente_id', '=', 'utenti.id')
        .on('partecipazioni.partita_id', '=', partitaId),
    )
    .select(['utenti.id', 'partecipazioni.utente_id as partecipante'])
    .where('utenti.email', '=', email)
    .executeTakeFirst();
  if (invitato?.id === masterId) {
    throw new ErroreHttp(409, 'Sei il Master di questa partita', { email: 'È la tua email' });
  }
  if (invitato?.partecipante) {
    throw new ErroreHttp(409, 'Partecipa già alla partita', {
      email: 'Questa persona partecipa già alla partita',
    });
  }
  if (personaggioId !== null) {
    const pg = await db
      .selectFrom('personaggi')
      .select('id')
      .where('id', '=', personaggioId)
      .where('partita_id', '=', partitaId)
      .executeTakeFirst();
    if (!pg) {
      throw new ErroreHttp(400, 'Controlla i dati inseriti', {
        personaggioId: 'Personaggio inesistente',
      });
    }
  }

  const token = nuovoToken();
  const id = await db.transaction().execute(async (trx) => {
    await trx
      .deleteFrom('inviti')
      .where('partita_id', '=', partitaId)
      .where('email', '=', email)
      .where('accettato_il', 'is', null)
      .execute();
    const { insertId } = await trx
      .insertInto('inviti')
      .values({
        partita_id: partitaId,
        email,
        ruolo,
        personaggio_id: personaggioId,
        token_hash: hashToken(token),
        scade_il: new Date(ora.getTime() + DURATA_INVITO_MS),
        accettato_il: null,
        accettato_da: null,
      })
      .executeTakeFirstOrThrow();
    return Number(insertId);
  });
  const riga = await db
    .selectFrom('inviti')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirstOrThrow();
  return { invito: aInvito(riga, ora), token };
}

export async function revocaInvito(db: Db, partitaId: number, invitoId: number): Promise<void> {
  const { numDeletedRows } = await db
    .deleteFrom('inviti')
    .where('id', '=', invitoId)
    .where('partita_id', '=', partitaId)
    .where('accettato_il', 'is', null)
    .executeTakeFirst();
  if (numDeletedRows === 0n) throw new ErroreHttp(404, 'Invito non trovato');
}

async function trovaInvito(db: Db, token: string) {
  const riga = await db
    .selectFrom('inviti')
    .innerJoin('partite', 'partite.id', 'inviti.partita_id')
    .innerJoin('utenti as master', 'master.id', 'partite.master_id')
    .leftJoin('personaggi', 'personaggi.id', 'inviti.personaggio_id')
    .selectAll('inviti')
    .select([
      'partite.titolo as partita_titolo',
      'partite.stato as partita_stato',
      'partite.master_id',
      'master.nome as master_nome',
      'personaggi.nome as personaggio_nome',
      'personaggi.utente_id as personaggio_utente',
    ])
    .where('inviti.token_hash', '=', hashToken(token))
    .executeTakeFirst();
  if (!riga)
    throw new ErroreHttp(404, 'Invito non trovato: controlla il link o chiedine uno nuovo');
  return riga;
}

function statoInvito(r: Awaited<ReturnType<typeof trovaInvito>>, ora: Date): InfoInvito['stato'] {
  if (r.accettato_il) return 'usato';
  if (r.partita_stato === 'archiviata') return 'partita archiviata';
  if (r.scade_il <= ora) return 'scaduto';
  return 'valido';
}

/** Dati dell'invito per chi apre il link, anche senza aver effettuato l'accesso. */
export async function infoInvito(db: Db, token: string, ora: Date): Promise<InfoInvito> {
  const r = await trovaInvito(db, token);
  return {
    partita: { titolo: r.partita_titolo },
    master: { nome: r.master_nome },
    email: r.email,
    ruolo: r.ruolo,
    personaggio: r.personaggio_nome,
    stato: statoInvito(r, ora),
  };
}

/**
 * Accetta l'invito: l'utente deve avere la stessa email a cui è stato inviato.
 * Crea la partecipazione e assegna il PG indicato, se è ancora libero.
 */
export async function accettaInvito(
  db: Db,
  { token, utente, ora }: { token: string; utente: { id: number; email: string }; ora: Date },
): Promise<number> {
  const r = await trovaInvito(db, token);
  const stato = statoInvito(r, ora);
  if (stato === 'usato') throw new ErroreHttp(409, 'Questo invito è già stato usato');
  if (stato === 'scaduto')
    throw new ErroreHttp(410, 'Questo invito è scaduto: chiedine uno nuovo al Master');
  if (stato === 'partita archiviata') throw new ErroreHttp(409, 'La partita è stata archiviata');
  if (r.email !== utente.email) {
    throw new ErroreHttp(
      403,
      `Questo invito è per ${r.email}: accedi con quell'account per accettarlo`,
    );
  }
  if (r.master_id === utente.id) throw new ErroreHttp(409, 'Sei il Master di questa partita');

  await db.transaction().execute(async (trx) => {
    const { numUpdatedRows } = await trx
      .updateTable('inviti')
      .set({ accettato_il: ora, accettato_da: utente.id })
      .where('id', '=', r.id)
      .where('accettato_il', 'is', null)
      .executeTakeFirst();
    if (numUpdatedRows !== 1n) throw new ErroreHttp(409, 'Questo invito è già stato usato');

    await trx
      .insertInto('partecipazioni')
      .values({
        partita_id: r.partita_id,
        utente_id: utente.id,
        ruolo: r.ruolo,
        personaggio_id: null,
      })
      .onDuplicateKeyUpdate({ ruolo: r.ruolo })
      .execute();
    if (r.personaggio_id !== null && r.ruolo === 'giocatore' && r.personaggio_utente === null) {
      await trx
        .updateTable('personaggi')
        .set({ utente_id: utente.id })
        .where('id', '=', r.personaggio_id)
        .where('utente_id', 'is', null)
        .execute();
      await preselezionaPersonaggio(trx, r.partita_id, utente.id, r.personaggio_id);
    }
  });
  return r.partita_id;
}
