import { DettaglioPartita } from '@dandzapp/shared';
import { error } from '@sveltejs/kit';
import { api, ErroreApi } from '#lib/api.ts';

/** Dettaglio di una partita per le pagine `/partite/[id]`; 404 se non vi si partecipa. */
export async function caricaPartita(id: string, f: typeof fetch): Promise<DettaglioPartita> {
  if (!/^\d+$/.test(id)) error(404, 'Partita non trovata');
  try {
    return await api(`/api/partite/${id}`, { schema: DettaglioPartita, fetch: f });
  } catch (e) {
    if (e instanceof ErroreApi && (e.stato === 404 || e.stato === 403)) error(e.stato, e.message);
    throw e;
  }
}

export const NOMI_RUOLO = {
  master: 'Master',
  giocatore: 'Giocatore',
  osservatore: 'Osservatore',
} as const;
