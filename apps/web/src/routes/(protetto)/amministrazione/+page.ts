import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

/** Pannello riservato ai ROLE_MASTER. Il server lo verifica comunque su ogni richiesta. */
export const load: PageLoad = async ({ parent }) => {
  const { utente } = await parent();
  if (utente.ruolo !== 'ROLE_MASTER') error(403, 'Solo i Master possono amministrare gli utenti');
  return { utente };
};
