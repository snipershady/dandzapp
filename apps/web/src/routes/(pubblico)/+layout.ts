import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';

const SOLO_OSPITI = ['/accedi', '/registrati'];

/** Chi ha già effettuato l'accesso non vede le pagine di accesso e registrazione. */
export const load: LayoutLoad = async ({ parent, url }) => {
  const { utente } = await parent();
  if (utente && SOLO_OSPITI.includes(url.pathname)) redirect(307, '/');
};
