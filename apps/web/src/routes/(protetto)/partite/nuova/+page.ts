import { RispostaElencoAvventure } from '@dandzapp/shared';
import { error } from '@sveltejs/kit';
import { api } from '#lib/api.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent, fetch }) => {
  const { utente } = await parent();
  if (utente.ruolo !== 'ROLE_MASTER') error(403, 'Solo i Master possono creare partite');
  return {
    avventure: (await api('/api/avventure', { schema: RispostaElencoAvventure, fetch })).avventure,
  };
};
