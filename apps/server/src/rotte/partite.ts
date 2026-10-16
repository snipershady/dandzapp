import { createReadStream } from 'node:fs';
import {
  CorpoGiochiCome,
  CorpoInvito,
  CorpoModificaPartecipante,
  CorpoModificaPartita,
  CorpoModificaPersonaggio,
  CorpoNuovaPartita,
  CorpoPersonaggio,
  type DettaglioPartita,
  type InfoInvito,
  type Personaggio,
  type RispostaElencoPartite,
  type RispostaInvitoCreato,
  type RispostaPartitaCreata,
} from '@dandzapp/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Dipendenze } from '../app.ts';
import { richiediRuolo, richiediUtente } from '../auth/plugin.ts';
import { emailInvito } from '../email/modelli.ts';
import { ErroreHttp, valida } from '../http/errori.ts';
import { accessoPartita, richiediMasterPartita } from '../partite/accesso.ts';
import { accettaInvito, creaInvito, infoInvito, revocaInvito } from '../partite/inviti.ts';
import { fileMappa } from '../partite/mappa.ts';
import {
  cambiaRuoloPartecipante,
  rimuoviPartecipante,
  scegliPersonaggio,
} from '../partite/partecipanti.ts';
import {
  creaPartita,
  dettaglioPartita,
  elencaPartite,
  eliminaPartita,
  modificaPartita,
} from '../partite/partite.ts';
import { creaPersonaggio, eliminaPersonaggio, modificaPersonaggio } from '../partite/personaggi.ts';

const Id = z.coerce.number().int().positive();
const ParamPartita = z.object({ id: Id });
const ParamPersonaggio = z.object({ id: Id, personaggioId: Id });
const ParamPartecipante = z.object({ id: Id, utenteId: Id });
const ParamInvito = z.object({ id: Id, invitoId: Id });
const ParamToken = z.object({ token: z.string().min(1).max(200) });

/** Partite, PG, partecipanti e inviti (RF-02, RF-03, RF-05, RF-06). */
export function rottePartite(
  app: FastifyInstance,
  { config, db, postino, ora, tempoReale }: Dipendenze,
): void {
  /** Master della partita, con la partita ancora attiva per le modifiche ai partecipanti. */
  async function masterDi(richiesta: Parameters<typeof richiediUtente>[0], partitaId: number) {
    const utente = richiediUtente(richiesta);
    return { utente, partita: await richiediMasterPartita(db, partitaId, utente.id) };
  }

  app.get('/api/partite', async (richiesta) => {
    const corpo: RispostaElencoPartite = await elencaPartite(db, richiediUtente(richiesta).id);
    return corpo;
  });

  app.post('/api/partite', async (richiesta, risposta) => {
    const master = richiediRuolo(richiesta, 'ROLE_MASTER');
    const dati = valida(CorpoNuovaPartita, richiesta.body);
    const corpo: RispostaPartitaCreata = {
      id: await creaPartita(db, { masterId: master.id, ...dati }),
    };
    return risposta.code(201).send(corpo);
  });

  app.get('/api/partite/:id', async (richiesta) => {
    const utente = richiediUtente(richiesta);
    const { id } = valida(ParamPartita, richiesta.params);
    const { ruolo } = await accessoPartita(db, id, utente.id);
    const corpo: DettaglioPartita = await dettaglioPartita(db, id, ruolo);
    return corpo;
  });

  app.patch('/api/partite/:id', async (richiesta, risposta) => {
    const { id } = valida(ParamPartita, richiesta.params);
    await masterDi(richiesta, id);
    await modificaPartita(db, id, valida(CorpoModificaPartita, richiesta.body));
    await tempoReale.notifica(id);
    return risposta.code(204).send();
  });

  app.delete('/api/partite/:id', async (richiesta, risposta) => {
    const { id } = valida(ParamPartita, richiesta.params);
    await masterDi(richiesta, id);
    await eliminaPartita(db, id);
    tempoReale.partitaEliminata(id);
    return risposta.code(204).send();
  });

  /**
   * Immagine della mappa (RF-10, §15.3): intera per il Master, con le sole zone scoperte
   * per gli altri. Mai in cache condivise; il browser la riconvalida con l'ETag.
   */
  app.get('/api/partite/:id/mappa', async (richiesta, risposta) => {
    const utente = richiediUtente(richiesta);
    const { id } = valida(ParamPartita, richiesta.params);
    const { ruolo } = await accessoPartita(db, id, utente.id);
    const { file, chiave } = await fileMappa(db, config.cartellaDati, id, ruolo);
    const etag = `"${chiave}"`;
    risposta.header('Cache-Control', 'private, no-cache').header('ETag', etag);
    if (richiesta.headers['if-none-match'] === etag) return risposta.code(304).send();
    return risposta.type('image/png').send(createReadStream(file));
  });

  // ---------------------------------------------------------------- personaggi

  app.post('/api/partite/:id/personaggi', async (richiesta, risposta) => {
    const { id } = valida(ParamPartita, richiesta.params);
    await masterDi(richiesta, id);
    const corpo: Personaggio = await creaPersonaggio(
      db,
      id,
      valida(CorpoPersonaggio, richiesta.body),
    );
    await tempoReale.notifica(id);
    return risposta.code(201).send(corpo);
  });

  app.patch('/api/partite/:id/personaggi/:personaggioId', async (richiesta) => {
    const { id, personaggioId } = valida(ParamPersonaggio, richiesta.params);
    await masterDi(richiesta, id);
    const modifiche = valida(CorpoModificaPersonaggio, richiesta.body);
    const corpo: Personaggio = await modificaPersonaggio(db, id, personaggioId, modifiche);
    await tempoReale.notifica(id);
    return corpo;
  });

  app.delete('/api/partite/:id/personaggi/:personaggioId', async (richiesta, risposta) => {
    const { id, personaggioId } = valida(ParamPersonaggio, richiesta.params);
    await masterDi(richiesta, id);
    await eliminaPersonaggio(db, id, personaggioId);
    await tempoReale.notifica(id);
    return risposta.code(204).send();
  });

  // ---------------------------------------------------------------- partecipanti

  app.patch('/api/partite/:id/partecipanti/:utenteId', async (richiesta, risposta) => {
    const { id, utenteId } = valida(ParamPartecipante, richiesta.params);
    await masterDi(richiesta, id);
    const { ruolo } = valida(CorpoModificaPartecipante, richiesta.body);
    await cambiaRuoloPartecipante(db, id, utenteId, ruolo);
    await tempoReale.notifica(id);
    return risposta.code(204).send();
  });

  /** Il Master toglie un partecipante; un partecipante può anche lasciare la partita da sé. */
  app.delete('/api/partite/:id/partecipanti/:utenteId', async (richiesta, risposta) => {
    const utente = richiediUtente(richiesta);
    const { id, utenteId } = valida(ParamPartecipante, richiesta.params);
    const { ruolo } = await accessoPartita(db, id, utente.id);
    if (ruolo !== 'master' && utenteId !== utente.id) {
      throw new ErroreHttp(403, 'Solo il Master della partita può farlo');
    }
    await rimuoviPartecipante(db, id, utenteId);
    await tempoReale.espelli(
      id,
      utenteId,
      utenteId === utente.id ? 'Hai lasciato la partita' : 'Il Master ti ha tolto dalla partita',
    );
    await tempoReale.notifica(id);
    return risposta.code(204).send();
  });

  /** "Giochi come" (RF-03): il giocatore sceglie il proprio PG. */
  app.put('/api/partite/:id/io', async (richiesta, risposta) => {
    const utente = richiediUtente(richiesta);
    const { id } = valida(ParamPartita, richiesta.params);
    const { ruolo } = await accessoPartita(db, id, utente.id);
    if (ruolo === 'master') throw new ErroreHttp(403, 'Il Master gioca come Master');
    const { personaggioId } = valida(CorpoGiochiCome, richiesta.body);
    await scegliPersonaggio(db, id, utente.id, personaggioId);
    await tempoReale.notifica(id);
    return risposta.code(204).send();
  });

  // ---------------------------------------------------------------- inviti

  app.post('/api/partite/:id/inviti', async (richiesta, risposta) => {
    const { id } = valida(ParamPartita, richiesta.params);
    const { utente, partita } = await masterDi(richiesta, id);
    if (partita.stato === 'archiviata') {
      throw new ErroreHttp(409, 'La partita è archiviata: riattivala per invitare qualcuno');
    }
    const dati = valida(CorpoInvito, richiesta.body);
    const { invito, token } = await creaInvito(db, {
      partitaId: id,
      masterId: utente.id,
      ...dati,
      ora: ora(),
    });
    const link = `${config.urlApp}/inviti/${token}`;
    postino
      .invia(
        emailInvito(invito.email, {
          master: utente.nome,
          partita: partita.titolo,
          ruolo: invito.ruolo,
          link,
        }),
      )
      .catch((errore: unknown) => richiesta.log.error(errore, 'Invio email non riuscito'));
    await tempoReale.notifica(id, { soloMaster: true });
    const corpo: RispostaInvitoCreato = { invito, link };
    return risposta.code(201).send(corpo);
  });

  app.delete('/api/partite/:id/inviti/:invitoId', async (richiesta, risposta) => {
    const { id, invitoId } = valida(ParamInvito, richiesta.params);
    await masterDi(richiesta, id);
    await revocaInvito(db, id, invitoId);
    await tempoReale.notifica(id, { soloMaster: true });
    return risposta.code(204).send();
  });

  /** Pubblica: chi ha il link vede di che invito si tratta, anche prima di registrarsi. */
  app.get('/api/inviti/:token', async (richiesta) => {
    const { token } = valida(ParamToken, richiesta.params);
    const corpo: InfoInvito = await infoInvito(db, token, ora());
    return corpo;
  });

  app.post('/api/inviti/:token/accetta', async (richiesta) => {
    const utente = richiediUtente(richiesta);
    const { token } = valida(ParamToken, richiesta.params);
    const partitaId = await accettaInvito(db, { token, utente, ora: ora() });
    await tempoReale.notifica(partitaId);
    const corpo: RispostaPartitaCreata = { id: partitaId };
    return corpo;
  });
}
