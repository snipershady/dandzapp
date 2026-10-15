import { afterEach, beforeEach, expect, it } from 'vitest';
import { creaOPromuoviMaster } from '../src/utenti/master.ts';
import { creaContesto, io, registra, type Contesto } from './aiuti.ts';

let ctx: Contesto;
beforeEach(async () => {
  ctx = await creaContesto();
});
afterEach(() => ctx.chiudi());

it('crea un Master senza password, che quindi non può ancora accedere', async () => {
  const { utente, creato } = await creaOPromuoviMaster(ctx.db, {
    email: 'master@esempio.it',
    nome: 'Il Master',
  });
  expect(creato).toBe(true);
  expect(utente).toMatchObject({ ruolo: 'ROLE_MASTER', password_hash: null });

  const accesso = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/accesso',
    payload: { email: 'master@esempio.it', password: 'qualsiasi-password' },
  });
  expect(accesso.statusCode).toBe(401);
});

it('promuove a Master un giocatore esistente senza toccarne la sessione', async () => {
  const token = await registra(ctx.app, { email: 'irene@esempio.it' });
  const { creato } = await creaOPromuoviMaster(ctx.db, { email: 'irene@esempio.it', nome: 'X' });

  expect(creato).toBe(false);
  expect((await io(ctx.app, token)).json().utente.ruolo).toBe('ROLE_MASTER');
});
