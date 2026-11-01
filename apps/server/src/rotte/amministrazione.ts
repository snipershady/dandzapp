import {
  CorpoModificaUtente,
  type RispostaElencoPartiteAmministrate,
  type RispostaElencoUtenti,
  type RispostaUtenteAmministrato,
} from '@dandzapp/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Dipendenze } from '../app.ts';
import { richiediRuolo } from '../auth/plugin.ts';
import { ErroreHttp, valida } from '../http/errori.ts';
import { elencaPartiteAmministrate, eliminaPartita } from '../partite/partite.ts';
import { elencaUtenti, modificaUtente } from '../utenti/amministrazione.ts';

const QueryElenco = z.object({ cerca: z.string().trim().max(100).default('') });
const ParametriUtente = z.object({ id: z.coerce.number().int().positive() });

/** Amministrazione degli utenti, riservata ai ROLE_MASTER (§4.1, RF-01b). */
export function rotteAmministrazione(app: FastifyInstance, { db, tempoReale }: Dipendenze): void {
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
    // Un account disattivato perde subito anche i collegamenti in tempo reale.
    if (!corpo.utente.attivo) tempoReale.chiudiUtente(id);
    return corpo;
  });

  // Ogni ROLE_MASTER può vedere ed eliminare qualsiasi partita (§4.1).
  app.get('/api/amministrazione/partite', async (richiesta) => {
    richiediRuolo(richiesta, 'ROLE_MASTER');
    const corpo: RispostaElencoPartiteAmministrate = {
      partite: await elencaPartiteAmministrate(db),
    };
    return corpo;
  });

  app.delete('/api/amministrazione/partite/:id', async (richiesta, risposta) => {
    richiediRuolo(richiesta, 'ROLE_MASTER');
    const { id } = valida(ParametriUtente, richiesta.params);
    if (!(await eliminaPartita(db, id))) throw new ErroreHttp(404, 'Partita non trovata');
    tempoReale.partitaEliminata(id);
    return risposta.code(204).send();
  });
}
