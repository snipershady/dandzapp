import { caricaPartita } from '#lib/partita/caricamento.ts';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ params, fetch, depends }) => {
  depends('app:partita');
  return { dettaglio: await caricaPartita(params.id, fetch) };
};
