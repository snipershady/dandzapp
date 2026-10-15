import { RispostaElencoPartite } from '@dandzapp/shared';
import { api } from '#lib/api.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => ({
  partite: await api('/api/partite', { schema: RispostaElencoPartite, fetch }),
});
