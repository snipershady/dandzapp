import type { CorpoModificaUtente, UtenteAmministrato } from '@dandzapp/shared';
import { MAX_UTENTI_ELENCO } from '@dandzapp/shared';
import { chiudiSessioniUtente } from '../auth/sessioni.ts';
import type { Db } from '../db/database.ts';
import type { RigaUtente } from '../db/schema.ts';
import { ErroreHttp } from '../http/errori.ts';

export function aUtenteAmministrato(riga: RigaUtente): UtenteAmministrato {
  return {
    id: riga.id,
    email: riga.email,
    nome: riga.nome,
    ruolo: riga.ruolo,
    attivo: Boolean(riga.attivo),
    haPassword: riga.password_hash !== null,
    creatoIl: riga.creato_il.toISOString(),
  };
}

/** Utenti ordinati per nome, filtrati per nome o email. */
export async function elencaUtenti(
  db: Db,
  cerca: string,
): Promise<{ utenti: UtenteAmministrato[]; totale: number }> {
  let query = db.selectFrom('utenti');
  if (cerca) {
    // I caratteri speciali di LIKE vengono neutralizzati: si cerca il testo così com'è.
    const motivo = `%${cerca.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    query = query.where((eb) => eb.or([eb('nome', 'like', motivo), eb('email', 'like', motivo)]));
  }
  const [righe, conteggio] = await Promise.all([
    query.selectAll().orderBy('nome').orderBy('id').limit(MAX_UTENTI_ELENCO).execute(),
    query.select((eb) => eb.fn.countAll<number>().as('totale')).executeTakeFirstOrThrow(),
  ]);
  return { utenti: righe.map(aUtenteAmministrato), totale: Number(conteggio.totale) };
}

/**
 * Cambia ruolo e/o stato di un utente. Regole:
 * - nessuno modifica il proprio account da qui (non ci si chiude fuori per sbaglio);
 * - resta sempre almeno un ROLE_MASTER attivo, anche con richieste simultanee
 *   (i Master attivi vengono bloccati con FOR UPDATE dentro la transazione);
 * - disattivare un account chiude subito le sue sessioni.
 */
export async function modificaUtente(
  db: Db,
  {
    attoreId,
    bersaglioId,
    modifiche,
  }: {
    attoreId: number;
    bersaglioId: number;
    modifiche: CorpoModificaUtente;
  },
): Promise<UtenteAmministrato> {
  if (attoreId === bersaglioId) {
    throw new ErroreHttp(409, 'Non puoi cambiare ruolo o stato al tuo stesso account');
  }

  return db.transaction().execute(async (trx) => {
    const mastersAttivi = await trx
      .selectFrom('utenti')
      .select('id')
      .where('ruolo', '=', 'ROLE_MASTER')
      .where('attivo', '=', 1)
      .forUpdate()
      .execute();

    const bersaglio = await trx
      .selectFrom('utenti')
      .selectAll()
      .where('id', '=', bersaglioId)
      .forUpdate()
      .executeTakeFirst();
    if (!bersaglio) throw new ErroreHttp(404, 'Utente non trovato');

    const eraMasterAttivo = bersaglio.ruolo === 'ROLE_MASTER' && Boolean(bersaglio.attivo);
    const sara = {
      ruolo: modifiche.ruolo ?? bersaglio.ruolo,
      attivo: modifiche.attivo ?? Boolean(bersaglio.attivo),
    };
    const saraMasterAttivo = sara.ruolo === 'ROLE_MASTER' && sara.attivo;
    if (eraMasterAttivo && !saraMasterAttivo && mastersAttivi.length <= 1) {
      throw new ErroreHttp(409, 'Deve restare almeno un Master attivo: promuovine un altro prima');
    }

    await trx
      .updateTable('utenti')
      .set({ ruolo: sara.ruolo, attivo: sara.attivo })
      .where('id', '=', bersaglioId)
      .execute();
    if (!sara.attivo) await chiudiSessioniUtente(trx, bersaglioId);

    const aggiornato = await trx
      .selectFrom('utenti')
      .selectAll()
      .where('id', '=', bersaglioId)
      .executeTakeFirstOrThrow();
    return aUtenteAmministrato(aggiornato);
  });
}
