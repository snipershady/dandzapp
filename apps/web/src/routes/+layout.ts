import { RispostaUtente, type Utente } from '@dandzapp/shared';
import { api, ErroreApi } from '#lib/api.ts';
import type { LayoutLoad } from './$types';

// Solo lato browser: i dati arrivano dall'API di Fastify.
export const ssr = false;

export const load: LayoutLoad = async ({ fetch, depends }) => {
  depends('app:utente');
  let utente: Utente | null = null;
  try {
    utente = (await api('/api/auth/io', { schema: RispostaUtente, fetch })).utente;
  } catch (errore) {
    if (!(errore instanceof ErroreApi && errore.stato === 401)) throw errore;
  }
  return { utente };
};
