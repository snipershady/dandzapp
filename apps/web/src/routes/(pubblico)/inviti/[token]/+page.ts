import { InfoInvito } from '@dandzapp/shared';
import { error } from '@sveltejs/kit';
import { api, ErroreApi } from '#lib/api.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch, parent }) => {
  const { utente } = await parent();
  try {
    const invito = await api(`/api/inviti/${encodeURIComponent(params.token)}`, {
      schema: InfoInvito,
      fetch,
    });
    return { invito, utente };
  } catch (e) {
    if (e instanceof ErroreApi && e.stato === 404) error(404, e.message);
    throw e;
  }
};
