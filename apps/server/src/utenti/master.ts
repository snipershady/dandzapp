import type { Db } from '../db/database.ts';
import type { RigaUtente } from '../db/schema.ts';
import { creaUtente, trovaUtentePerEmail, trovaUtentePerId } from './utenti.ts';

/**
 * Crea un utente ROLE_MASTER senza password, oppure promuove a ROLE_MASTER
 * un utente esistente. Serve all'installazione per il primo Master (RF-01b).
 */
export async function creaOPromuoviMaster(
  db: Db,
  dati: { email: string; nome: string },
): Promise<{ utente: RigaUtente; creato: boolean }> {
  const esistente = await trovaUtentePerEmail(db, dati.email);
  if (esistente) {
    await db
      .updateTable('utenti')
      .set({ ruolo: 'ROLE_MASTER', attivo: true })
      .where('id', '=', esistente.id)
      .execute();
    const aggiornato = await trovaUtentePerId(db, esistente.id);
    if (!aggiornato) throw new Error('Utente scomparso durante la promozione');
    return { utente: aggiornato, creato: false };
  }
  const nuovo = await creaUtente(db, { ...dati, passwordHash: null, ruolo: 'ROLE_MASTER' });
  if (!nuovo) throw new Error(`Impossibile creare l'utente ${dati.email}`);
  return { utente: nuovo, creato: true };
}
