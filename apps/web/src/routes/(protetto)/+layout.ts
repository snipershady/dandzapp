import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';

/** Pagine riservate a chi ha effettuato l'accesso. */
export const load: LayoutLoad = async ({ parent, url }) => {
  const { utente } = await parent();
  if (!utente) {
    const dopo = url.pathname + url.search;
    redirect(307, dopo === '/' ? '/accedi' : `/accedi?dopo=${encodeURIComponent(dopo)}`);
  }
  return { utente };
};
