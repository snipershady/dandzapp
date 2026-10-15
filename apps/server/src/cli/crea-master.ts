/**
 * Crea il primo Master, o promuove a Master un utente esistente (RF-01b).
 *
 * Uso: npm run utente:crea-master -- email@esempio.it "Nome visualizzato"
 *
 * A un utente nuovo arriva per email (e viene stampato qui) un link per scegliere la password.
 */
import pino from 'pino';
import { z } from 'zod';
import { creaRecupero, DURATA_PRIMO_ACCESSO_MS } from '../auth/recupero-password.ts';
import { caricaConfig } from '../config.ts';
import { creaDatabase } from '../db/database.ts';
import { emailPrimoAccessoMaster } from '../email/modelli.ts';
import { creaPostino } from '../email/postino.ts';
import { creaOPromuoviMaster } from '../utenti/master.ts';

const Argomenti = z.tuple([
  z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: 'Email non valida' })),
  z.string().trim().min(2, 'Il nome deve avere almeno 2 caratteri').max(60),
]);

const argomenti = Argomenti.safeParse(process.argv.slice(2));
if (!argomenti.success) {
  console.error('Uso: npm run utente:crea-master -- email@esempio.it "Nome visualizzato"');
  console.error(z.prettifyError(argomenti.error));
  process.exit(2);
}
const [email, nome] = argomenti.data;

const config = caricaConfig();
const db = creaDatabase(config.db);
try {
  const { utente, creato } = await creaOPromuoviMaster(db, { email, nome });
  if (!creato) {
    console.log(`✔ ${utente.email} (${utente.nome}) ora è ROLE_MASTER.`);
  } else {
    const token = await creaRecupero(db, utente.id, new Date(), DURATA_PRIMO_ACCESSO_MS);
    const link = `${config.urlApp}/reimposta-password?token=${token}`;
    await creaPostino(config, pino({ level: 'warn' })).invia(
      emailPrimoAccessoMaster(utente.email, utente.nome, link),
    );
    console.log(`✔ Creato il Master ${utente.email} (${utente.nome}).`);
    console.log(`  Link per scegliere la password (valido 7 giorni, inviato anche per email):`);
    console.log(`  ${link}`);
  }
} finally {
  await db.destroy();
}
