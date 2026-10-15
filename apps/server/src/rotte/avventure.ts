import type { RispostaElencoAvventure } from '@dandzapp/shared';
import type { FastifyInstance } from 'fastify';
import type { Dipendenze } from '../app.ts';
import { richiediRuolo } from '../auth/plugin.ts';

/**
 * Avventure importate. Il Master vede solo un riepilogo senza spoiler: le zone e le
 * immagini arrivano solo dentro una partita, filtrate in base alla nebbia (step 4 e 7).
 */
export function rotteAvventure(app: FastifyInstance, { db }: Dipendenze): void {
  app.get('/api/avventure', async (richiesta) => {
    richiediRuolo(richiesta, 'ROLE_MASTER');
    const righe = await db
      .selectFrom('avventure')
      .select(['slug', 'titolo', 'sottotitolo', 'definizione'])
      .orderBy('titolo')
      .execute();
    const corpo: RispostaElencoAvventure = {
      avventure: righe.map((r) => ({
        id: r.slug,
        titolo: r.titolo,
        sottotitolo: r.sottotitolo,
        numeroZone: r.definizione.zone.length,
        numeroPartenze: r.definizione.partenze.length,
        mostri: r.definizione.mostri.map((m) => m.nome),
      })),
    };
    return corpo;
  });
}
