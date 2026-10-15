import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
  const { dettaglio } = await parent();
  if (dettaglio.partita.mioRuolo !== 'master') {
    error(403, 'Solo il Master della partita può gestirla');
  }
};
