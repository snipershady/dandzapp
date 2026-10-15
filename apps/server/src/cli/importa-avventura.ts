/**
 * Importa o aggiorna un'avventura nel tavolo (step 3, §8).
 *
 * Uso: npm run avventura:importa -- avventure/sessione-0
 *
 * La cartella deve contenere avventura.json e le immagini prodotte da `npm run mappa:genera`.
 */
import path from 'node:path';
import { ErroreImportazione, importaAvventura } from '../avventure/importa.ts';
import { caricaConfig } from '../config.ts';
import { creaDatabase } from '../db/database.ts';

const argomento = process.argv[2];
if (!argomento) {
  console.error('Uso: npm run avventura:importa -- <cartella dell avventura>');
  process.exit(2);
}
// npm esegue lo script nella cartella del workspace: il percorso è relativo a dove è stato lanciato.
const cartella = path.resolve(process.env['INIT_CWD'] ?? process.cwd(), argomento);

const config = caricaConfig();
const db = creaDatabase(config.db);
try {
  const { definizione, nuova } = await importaAvventura(db, {
    cartella,
    cartellaDati: config.cartellaDati,
  });
  console.log(
    `✔ ${nuova ? 'Importata' : 'Aggiornata'} "${definizione.titolo}" (${definizione.id}) ` +
      `nel database "${config.db.nome}": ${definizione.zone.length} zone, ` +
      `${definizione.segreti.length} segreti, ${definizione.partenze.length} posti di partenza.`,
  );
} catch (errore) {
  if (!(errore instanceof ErroreImportazione)) throw errore;
  console.error(`✘ ${errore.message}`);
  process.exitCode = 1;
} finally {
  await db.destroy();
}
