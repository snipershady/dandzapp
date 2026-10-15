import {
  CorpoModificaUtente,
  type RispostaElencoUtenti,
  type RispostaUtenteAmministrato,
} from '@dandzapp/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Dipendenze } from '../app.ts';
import { richiediRuolo } from '../auth/plugin.ts';
import { valida } from '../http/errori.ts';
import { elencaUtenti, modificaUtente } from '../utenti/amministrazione.ts';

const QueryElenco = z.object({ cerca: z.string().trim().max(100).default('') });
const ParametriUtente = z.object({ id: z.coerce.number().int().positive() });

/** Amministrazione degli utenti, riservata ai ROLE_MASTER (§4.1, RF-01b). */
export function rotteAmministrazione(app: FastifyInstance, { db }: Dipendenze): void {
  app.get('/api/amministrazione/utenti', async (richiesta) => {
    richiediRuolo(richiesta, 'ROLE_MASTER');
    const { cerca } = valida(QueryElenco, richiesta.query);
    const corpo: RispostaElencoUtenti = await elencaUtenti(db, cerca);
    return corpo;
  });

  app.patch('/api/amministrazione/utenti/:id', async (richiesta) => {
    const attore = richiediRuolo(richiesta, 'ROLE_MASTER');
    const { id } = valida(ParametriUtente, richiesta.params);
    const modifiche = valida(CorpoModificaUtente, richiesta.body);
    const corpo: RispostaUtenteAmministrato = {
      utente: await modificaUtente(db, { attoreId: attore.id, bersaglioId: id, modifiche }),
    };
    return corpo;
  });
}
